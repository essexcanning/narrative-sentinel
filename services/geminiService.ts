import { GoogleGenAI, Type } from "@google/genai";
import { Narrative, Post, DMMIReport, DisarmAnalysis, CounterOpportunity, AnalysisInput, SearchSource } from '../types';
import { generateId } from "../utils/generateId";
import { urlToBase64 } from "../utils/mediaUtils";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set in the environment. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Helper to robustly extract JSON from a string that might contain markdown or other text
function extractJson(text: string): any {
    // Attempt to find JSON within a markdown code block first
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        try {
            return JSON.parse(markdownMatch[1].trim());
        } catch (e) {
            console.warn("Could not parse JSON from markdown block, attempting to find JSON in the full string.", e);
        }
    }

    // If no markdown, or if parsing markdown failed, find the first and last bracket/brace
    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    
    let startIndex = -1;
    if (firstBracket === -1 && firstBrace === -1) {
        throw new Error("No JSON object or array found in the response.");
    }
    
    if (firstBracket === -1) {
        startIndex = firstBrace;
    } else if (firstBrace === -1) {
        startIndex = firstBracket;
    } else {
        startIndex = Math.min(firstBracket, firstBrace);
    }
    
    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');
    const endIndex = Math.max(lastBracket, lastBrace);
    
    if (endIndex === -1) {
         throw new Error("Could not find a valid end for the JSON object or array.");
    }

    const jsonString = text.substring(startIndex, endIndex + 1);
    
    try {
        return JSON.parse(jsonString);
    } catch(e) {
        console.error("Failed to parse extracted JSON substring:", { jsonString, originalText: text });
        throw new Error("Failed to extract and parse valid JSON from the model's response.");
    }
}


// Schemas for structured responses
const narrativeSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A short, neutral, descriptive title for the narrative (5-10 words)." },
        summary: { type: Type.STRING, description: "A one-paragraph summary of the core message and claims of the narrative." },
        postIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of post IDs that belong to this narrative cluster." },
        riskScore: { type: Type.INTEGER, description: "An initial estimated risk score from 1 (low) to 10 (high) based on potential for harm and virality." }
      },
      required: ["title", "summary", "postIds", "riskScore"]
    }
};

const enrichmentSchema = {
  type: Type.OBJECT,
  properties: {
    dmmiReport: {
      type: Type.OBJECT,
      properties: {
        classification: { type: Type.STRING, enum: ['Disinformation', 'Misinformation', 'Malinformation', 'Information'] },
        intent: { type: Type.STRING, enum: ['Harmful', 'Benign', 'Uncertain'] },
        veracity: { type: Type.STRING, enum: ['False', 'Misleading', 'True', 'Unverified'] },
        successProbability: { type: Type.INTEGER, description: "Estimated probability of narrative success (0-100)." },
        rationale: { type: Type.STRING, description: "Brief rationale for the DMMI classification." }
      },
      required: ["classification", "intent", "veracity", "successProbability", "rationale"]
    },
    disarmAnalysis: {
        type: Type.OBJECT,
        properties: {
            phase: { type: Type.STRING, description: "The primary DISARM Red framework phase observed (e.g., 'Plan', 'Execute')." },
            tactics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of observed DISARM Red tactics." },
            techniques: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of observed DISARM Red techniques." },
            confidence: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
        },
        required: ["phase", "tactics", "techniques", "confidence"]
    },
    counterOpportunities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tactic: { type: Type.STRING, description: "A specific, defensive DISARM Blue framework tactic to counter the threat." },
          rationale: { type: Type.STRING, description: "A brief explanation of why this tactic is effective against the observed TTPs." }
        },
        required: ["tactic", "rationale"]
      }
    }
  },
  required: ["dmmiReport", "disarmAnalysis", "counterOpportunities"]
};

export const analyzeImageContent = async (base64Data: string, mimeType: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = "You are an expert in visual intelligence. Analyze this image and provide a concise, factual description of what it depicts. Focus on key subjects, actions, and any visible text or symbols. This description will be used to understand its role in an online narrative.";

    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: base64Data,
            },
        };
        const textPart = { text: prompt };
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [imagePart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error("Error in analyzeImageContent:", error);
        return ""; // Return empty string on failure
    }
};


export const fetchRealtimePosts = async (inputs: AnalysisInput): Promise<{ posts: Post[], sources: SearchSource[] }> => {
    const model = 'gemini-flash-lite-latest';
    const prompt = `
        You are a research assistant. Your task is to discover the most significant online content from "${inputs.country}" within the timeframe of ${inputs.timeFrame.start} to ${inputs.timeFrame.end}.
        Based on the user's selected Country and Time Frame, perform a Google search to find the top 5-10 most significant, controversial, or widely discussed news stories, events, and public discussions in that country.
        For each story, find a relevant article. From the article, extract a summary, author, timestamp, and link.
        CRITICALLY: Also extract the URL of the main representative image (imageUrl) or video (videoUrl) from the article if one exists.
        Synthesize your findings into a structured JSON array of 30-50 post objects reflecting these discovered topics.
        The JSON output must be enclosed in a single markdown code block like this: \`\`\`json ... \`\`\`.
        Each object in the array must have the following properties: "id" (string), "source" (string, one of 'Web Article', 'Social Media Post', 'News Report'), "author" (string), "content" (string summary), "timestamp" (string, YYYY-MM-DD), "link" (string URL), "imageUrl" (string, optional), and "videoUrl" (string, optional).
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        
        let posts: Post[];
        try {
            posts = extractJson(response.text);
        } catch (parseError) {
            console.error("Could not find or parse JSON in model response:", response.text);
            console.error("Parsing Error:", parseError);
            throw new Error("Failed to fetch real-time data. The AI model returned an invalid format.");
        }

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources: SearchSource[] = groundingChunks
            .map(chunk => ({
                uri: chunk.web?.uri || '',
                title: chunk.web?.title || 'Untitled Source'
            }))
            .filter(source => source.uri);

        const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());
        
        const postsWithMediaUrls = posts.map(post => ({
            ...post,
            imageUrl: post.imageUrl === 'N/A' ? undefined : post.imageUrl,
            videoUrl: post.videoUrl === 'N/A' ? undefined : post.videoUrl,
        }));


        return { posts: postsWithMediaUrls, sources: uniqueSources };

    } catch (error) {
        console.error("Error in fetchRealtimePosts:", error);
        if (error instanceof Error && error.message.includes("invalid format")) {
            throw error;
        }
        throw new Error("Failed to fetch real-time data from Google Search.");
    }
};


export const detectAndClusterNarratives = async (posts: Post[], context: string): Promise<Narrative[]> => {
    const model = 'gemini-flash-lite-latest';
    const postData = posts.map(p => `ID: ${p.id}, Source: ${p.source}, Author: ${p.author}, Content: "${p.content}"`).join('\n---\n');
    
    const prompt = `
        Analyze the following social media and news posts related to ${context}.
        Your task is to identify and cluster distinct narratives. A narrative is a consistent theme, story, or message that multiple posts contribute to.
        Ignore isolated or irrelevant posts.
        For each distinct narrative, provide a concise title, a summary, the IDs of the posts that form the narrative, and an initial risk score.
        Return ONLY the structured JSON array based on the schema, with no other text.

        Posts:
        ${postData}
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: narrativeSchema,
                temperature: 0.2,
            }
        });

        const detectedNarratives = extractJson(response.text) as Omit<Narrative, 'id' | 'status'>[];

        return detectedNarratives.map(n => ({ ...n, id: generateId(), status: 'pending' }));

    } catch (error) {
        console.error("Error in detectAndClusterNarratives:", error);
        throw new Error("Failed to detect narratives. The AI model may have returned an invalid response.");
    }
};

export const enrichNarrative = async (narrative: Narrative, posts: Post[]): Promise<Narrative> => {
    const model = 'gemini-2.5-pro';
    
    const postsWithMediaAnalysis = await Promise.all(
        posts.map(async (post) => {
            if (post.imageUrl) {
                const imageData = await urlToBase64(post.imageUrl);
                if (imageData) {
                    const description = await analyzeImageContent(imageData.base64, imageData.mimeType);
                    if (description) {
                        return { ...post, content: `${post.content}\n\n[Image Analysis: ${description}]` };
                    }
                }
            } else if (post.videoUrl) {
                return { ...post, content: `${post.content}\n\n[Video Content Present]` };
            }
            return post;
        })
    );

    const postContent = postsWithMediaAnalysis.map(p => `Author: ${p.author}, Content: "${p.content}"`).join('\n').substring(0, 8000);

    const prompt = `
        **CONTEXT:** You are an expert analyst in information warfare defense, specializing in both the DMMI and DISARM frameworks.
        **NARRATIVE FOR ANALYSIS:**
        - **Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **Sample Posts:**\n${postContent}

        **YOUR TASK:** Perform a comprehensive analysis and provide a structured JSON response with three top-level objects: 'dmmiReport', 'disarmAnalysis', and 'counterOpportunities'.
        
        1.  **DMMI Report:** Classify the narrative using the DMMI framework (Disinformation, Misinformation, Malinformation, Information). Evaluate intent, veracity, and probability of success.

        2.  **DISARM Analysis:** Analyze the narrative's tactics, techniques, and procedures (TTPs) using the DISARM Red framework. Identify the most likely phase, specific tactics, and techniques employed. Provide a confidence level for your assessment.

        3.  **Counter-Opportunities:** Based on your DISARM analysis, propose three distinct, ethical, and defensive counter-opportunities using the DISARM Blue framework. For each, specify a Blue tactic and a rationale explaining how it directly counters the observed Red TTPs. DO NOT suggest offensive or manipulative tactics.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: "application/json",
                responseSchema: enrichmentSchema,
                temperature: 0.5,
            }
        });
        
        const enrichmentData = extractJson(response.text) as {
            dmmiReport: DMMIReport;
            disarmAnalysis: DisarmAnalysis;
            counterOpportunities: CounterOpportunity[];
        };

        const trendData = Array.from({ length: 14 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (13 - i));
            return {
                date: date.toISOString().split('T')[0],
                volume: Math.floor(Math.random() * (narrative.riskScore * 15)) + (i * narrative.riskScore * Math.random() * 2)
            };
        });

        return { ...narrative, ...enrichmentData, posts: postsWithMediaAnalysis, trendData, status: 'complete' };

    } catch (error) {
        console.error(`Error enriching narrative "${narrative.title}":`, error);
        return { ...narrative, status: 'error' };
    }
};

export const generateAllianceBrief = async (narrative: Narrative): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `
        You are a senior communications expert tasked with briefing trusted partners in the 'Signal Alliance' to counter a hostile information operation.

        Based on the following intelligence report, generate a concise mission brief (approx. 300 words). The brief must be structured with these four sections, each clearly titled with markdown bolding (e.g., **Overview**):

        1.  **Overview:** A summary of the hostile narrative and its immediate risk.
        2.  **Key Message:** The core, truthful message our alliance should amplify to counter the narrative.
        3.  **Talking Points:** 3-4 specific, easy-to-use points that support the key message.
        4.  **Objective:** The primary goal of this counter-operation (e.g., "Inoculate the public against this falsehood," "Correct the record with verified facts," "Reduce the narrative's virality by 50%").

        **Intelligence Report:**
        - **Narrative Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **DMMI Assessment:** ${narrative.dmmiReport?.classification} with ${narrative.dmmiReport?.intent} intent. Rationale: ${narrative.dmmiReport?.rationale}
        - **DISARM TTPs Identified:** Phase: ${narrative.disarmAnalysis?.phase}. Tactics: ${narrative.disarmAnalysis?.tactics.join(', ')}. Techniques: ${narrative.disarmAnalysis?.techniques.join(', ')}.

        Generate only the text for the brief, starting with the "**Overview**" heading.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                temperature: 0.6,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating alliance brief:", error);
        throw new Error("Failed to generate mission brief.");
    }
};

export const generateTaskforceBrief = async (narrative: Narrative): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `
        You are a platform integrity analyst creating an assignment brief for the internal Digital Action Taskforce.

        Based on the following intelligence, generate a concise brief (approx. 150 words) for the team. The brief must be structured with these four sections, each clearly titled with markdown bolding (e.g., **Threat**):

        1.  **Threat:** A one-sentence summary of the hostile narrative.
        2.  **Suspected TTP:** List the primary DISARM TTPs identified (tactics and techniques).
        3.  **Suspected Platform Violation:** State the most likely platform policy violation (e.g., Coordinated Inauthentic Behavior, Hate Speech, Incitement to Violence).
        4.  **Action Required:** A clear, one-sentence directive for the team (e.g., "Investigate for network activity and coordinate content review," "Initiate takedown request based on policy X," "Monitor for further spread and amplification.").

        **Intelligence Report:**
        - **Narrative Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **DMMI Assessment:** ${narrative.dmmiReport?.classification} with ${narrative.dmmiReport?.intent} intent.
        - **DISARM TTPs Identified:** Tactics: ${narrative.disarmAnalysis?.tactics.join(', ')}. Techniques: ${narrative.disarmAnalysis?.techniques.join(', ')}.

        Generate only the text for the brief, starting with the "**Threat**" heading.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                temperature: 0.5,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating taskforce brief:", error);
        throw new Error("Failed to generate assignment brief.");
    }
};