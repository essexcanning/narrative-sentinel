
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Narrative, Post, DMMIReport, DisarmAnalysis, CounterOpportunity, AnalysisInput, SearchSource, Attribution, SimulationResult } from '../types';
import { generateId } from "../utils/generateId";

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
        veracityScore: { type: Type.INTEGER, description: "Score 0-10. 0 = Complete Falsehood, 10 = Absolute Truth." },
        harmScore: { type: Type.INTEGER, description: "Score 0-10. 0 = Harmless, 10 = Severe Societal Harm." },
        probabilityScore: { type: Type.INTEGER, description: "Score 0-10. 0 = Highly Unlikely to succeed, 10 = Highly Likely/Viral." },
        matrixRiskScore: { type: Type.INTEGER, description: "Calculated total risk (0-10) based on the DMMI Matrix Cube formula." },
        rationale: { type: Type.STRING, description: "Brief rationale for the DMMI classification." }
      },
      required: ["classification", "intent", "veracity", "veracityScore", "harmScore", "probabilityScore", "matrixRiskScore", "rationale"]
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
    attribution: {
        type: Type.OBJECT,
        properties: {
             suspectedOrigin: { type: Type.STRING, description: "Hypothesized origin (e.g., 'State-affiliated media', 'Domestic political group', 'Organic user', 'Unknown')." },
             keyAmplifiers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key amplifier types (e.g., 'Bot network', 'Influencers', 'Official accounts')." },
             networkDynamics: { type: Type.STRING, description: "Description of spread pattern (e.g., 'Coordinated Inauthentic Behavior', 'Viral organic', 'Astroturfing')." },
             confidenceScore: { type: Type.INTEGER, description: "Confidence in this attribution assessment (1-10)." }
        },
        required: ["suspectedOrigin", "keyAmplifiers", "networkDynamics", "confidenceScore"]
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
    },
    updatedRiskScore: {
        type: Type.INTEGER,
        description: "An updated risk score from 1 (low) to 10 (high) based on the deep analysis of TTPs, veracity, and potential for harm."
    }
  },
  required: ["dmmiReport", "disarmAnalysis", "attribution", "counterOpportunities", "updatedRiskScore"]
};

const wargameSchema = {
    type: Type.OBJECT,
    properties: {
        turns: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    round: { type: Type.INTEGER },
                    adversaryReaction: {
                        type: Type.OBJECT,
                        properties: {
                            action: { type: Type.STRING, description: "The adversary's specific counter-move to our tactic." },
                            likelyTTP: { type: Type.STRING, description: "The DISARM technique they will likely switch to." }
                        },
                         required: ["action", "likelyTTP"]
                    },
                    publicPerception: { type: Type.STRING, description: "How the general public or target audience reacts to this exchange." },
                    projectedRiskChange: { type: Type.INTEGER, description: "Change in risk score (negative for reduction, positive for escalation)." }
                },
                required: ["round", "adversaryReaction", "publicPerception", "projectedRiskChange"]
            }
        },
        finalOutcome: { type: Type.STRING, description: "The likely state of the narrative after 2 rounds of interaction." },
        strategicAdjustment: { type: Type.STRING, description: "Advice for the Blue Team to improve their plan based on this simulation." }
    },
    required: ["turns", "finalOutcome", "strategicAdjustment"]
};

export const fetchRealtimePosts = async (inputs: AnalysisInput): Promise<{ posts: Post[], sources: SearchSource[] }> => {
    const model = 'gemini-flash-lite-latest';
    const sourceList = inputs.sources.join(', ');
    
    const prompt = `
        You are a research assistant. Your task is to discover the most significant online content from "${inputs.country}" within the timeframe of ${inputs.timeFrame.start} to ${inputs.timeFrame.end}.
        
        **TARGET SOURCES:** ${sourceList}

        **INSTRUCTIONS:**
        Perform a Google search to find the top 5-10 most significant, controversial, or widely discussed news stories, events, and public discussions in that country.
        
        CRITICAL SEARCH STRATEGY:
        - If "Reddit" is in target sources, prioritize searching for threads on site:reddit.com related to current events in ${inputs.country}.
        - If "Telegram" is in target sources, search for public channel discussions or summaries of Telegram activity (e.g. site:t.me or "telegram channel" keywords).
        - If "TikTok" is in target sources, search for trends or viral video descriptions related to ${inputs.country} (e.g. site:tiktok.com).
        - If "X / Twitter" is in target sources, search for public threads or viral posts on site:twitter.com or site:x.com.
        - If "Google News / Search" is in target sources, search general news outlets.
        
        For each story/discussion found:
        1. Extract a summary, author/user/channel name, timestamp, and link.
        2. Identify the source type (e.g., 'Reddit Thread', 'Telegram Channel', 'TikTok Trend', 'X Post', 'Web Article').
        3. Try to find a representative image URL (imageUrl) or video URL (videoUrl).

        Synthesize your findings into a structured JSON array of 30-50 post objects.
        The JSON output must be enclosed in a single markdown code block like this: \`\`\`json ... \`\`\`.
        Each object in the array must have: 
        - "id" (string)
        - "source" (string, e.g. 'Reddit', 'Telegram', 'TikTok', 'X/Twitter', 'Web Article', 'News Report')
        - "author" (string)
        - "content" (string summary)
        - "timestamp" (string, YYYY-MM-DD)
        - "link" (string URL)
        - "imageUrl" (string, optional)
        - "videoUrl" (string, optional).
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
    
    // Simplified media handling to be more robust without a backend proxy for images.
    // Instead of fetching images (which fails due to CORS), just note their presence.
    const postsWithMediaNotes = posts.map((post) => {
        if (post.imageUrl) {
            return { ...post, content: `${post.content}\n\n[Image Content Present]` };
        } else if (post.videoUrl) {
            return { ...post, content: `${post.content}\n\n[Video Content Present]` };
        }
        return post;
    });

    const postContent = postsWithMediaNotes.map(p => `Author: ${p.author}, Content: "${p.content}"`).join('\n').substring(0, 8000);

    const prompt = `
        **CONTEXT:** You are an expert analyst in information warfare defense, specializing in the **DMMI Matrix Cube** for risk assessment.
        **NARRATIVE FOR ANALYSIS:**
        - **Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **Initial Risk Score:** ${narrative.riskScore}
        - **Sample Posts:**\n${postContent}

        **YOUR TASK:** Perform a comprehensive analysis and provide a structured JSON response.
        
        1.  **DMMI Matrix Cube Assessment:**
            - Assess the narrative on three specific axes (0-10 scale):
              - **Veracity (v):** 0 (Total Lie) to 10 (Verified Fact).
              - **Intention to Harm (i):** 0 (Benign) to 10 (Severe/Existential).
              - **Probability of Success (P):** 0 (Highly Unlikely) to 10 (Highly Likely/Viral).
            - Calculate the **Matrix Risk Score** based on these factors. Generally, high harm + low veracity + high probability = Maximum Risk. Malinformation is High Harm + High Veracity + High Probability.
            - Classify the type (Disinformation, Misinformation, Malinformation, Information).

        2.  **DISARM Analysis:** Analyze TTPs using the DISARM Red framework (Phase, Tactics, Techniques).

        3.  **Attribution Intelligence:**
            - Based on the content style, timing, and source types, hypothesize the **suspected origin** (e.g., State-affiliated media', 'Domestic political group', 'Organic user').
            - Identify likely **key amplifiers** (e.g., Bot network, Influencers, Official accounts).
            - Describe the **network dynamics** (e.g., Coordinated Inauthentic Behavior, Viral organic spread).
            - Provide a **confidence score** (1-10) for this attribution assessment.

        4.  **Counter-Opportunities:** Propose three defensive counter-opportunities (DISARM Blue).
        
        5.  **Updated Risk Score:** An overall score (1-10) aligning with the Matrix Risk Score.
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
            attribution: Attribution;
            counterOpportunities: CounterOpportunity[];
            updatedRiskScore: number;
        };

        const trendData = Array.from({ length: 14 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (13 - i));
            return {
                date: date.toISOString().split('T')[0],
                volume: Math.floor(Math.random() * (narrative.riskScore * 15)) + (i * narrative.riskScore * Math.random() * 2)
            };
        });

        let isTrending = false;
        
        // Check for significant volume increase
        if (trendData.length >= 2) {
            const lastVolume = trendData[trendData.length - 1].volume;
            const secondLastVolume = trendData[trendData.length - 2].volume;
            if (secondLastVolume > 0 && lastVolume > secondLastVolume * 1.5) {
                isTrending = true;
            }
        }

        // Check for significant risk score increase
        const initialRiskScore = narrative.riskScore;
        const finalRiskScore = enrichmentData.updatedRiskScore ?? initialRiskScore;
        // Define significant increase as jumping 3+ points.
        if (finalRiskScore > initialRiskScore + 2) {
             isTrending = true;
        }
        
        const { updatedRiskScore, ...reportData } = enrichmentData;

        return { 
            ...narrative, 
            ...reportData, 
            riskScore: finalRiskScore,
            posts: postsWithMediaNotes, 
            trendData, 
            status: 'complete', 
            isTrending 
        };

    } catch (error) {
        console.error(`Error enriching narrative "${narrative.title}":`, error);
        return { ...narrative, status: 'error' };
    }
};

export const generateCounterActionPlan = async (narrative: Narrative, counter: CounterOpportunity): Promise<string> => {
    const model = 'gemini-2.5-pro';
    
    const prompt = `
        **CONTEXT:** You are a world-class strategic communications expert and information defense planner. You are tasked with operationalizing a proposed counter-narrative tactic.

        **HOSTILE NARRATIVE FOR COUNTERING:**
        - **Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **Identified Adversary TTPs (DISARM Framework):**
            - **Phase:** ${narrative.disarmAnalysis?.phase}
            - **Tactics:** ${narrative.disarmAnalysis?.tactics.join(', ')}
            - **Techniques:** ${narrative.disarmAnalysis?.techniques.join(', ')}

        **PROPOSED COUNTER-TACTIC (DISARM Blue Framework):**
        - **Tactic:** "${counter.tactic}"
        - **Rationale:** "${counter.rationale}"

        **YOUR TASK:**
        Engage deep thinking to devise a comprehensive, step-by-step action plan to implement this counter-tactic effectively. The plan must be detailed, ethical, practical, and directly address the adversary's TTPs.

        Structure your response in markdown format with the following five sections. Use bold markdown for headings (e.g., **Objective**).

        1.  **Objective:** A single, clear, and measurable goal for this action plan.
        2.  **Target Audience(s):** Who are the primary and secondary audiences for this counter-messaging? Be specific (e.g., "Journalists covering technology," "Parents of school-aged children in the affected region").
        3.  **Key Messaging & Content:** What is the core message? Provide 3-5 specific talking points or content ideas (e.g., "Develop a one-page fact sheet," "Create a short animated video explaining the technique").
        4.  **Execution Steps:** A numbered list of concrete steps to take. Be specific about platforms and actions (e.g., "1. Draft a press release and distribute to tech reporters. 2. Share the animated video on Twitter and Facebook. 3. Engage with fact-checking organizations.").
        5.  **Metrics for Success (KPIs):** How will you measure success? List 2-3 key performance indicators (e.g., "Number of positive media mentions," "Reach and engagement rate of our video," "Reduction in sharing of the original hostile narrative").
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                temperature: 0.6,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating counter action plan:", error);
        throw new Error("Failed to generate the detailed action plan.");
    }
};

export const runWargameSimulation = async (narrative: Narrative, counter: CounterOpportunity, actionPlan: string): Promise<SimulationResult> => {
    const model = 'gemini-2.5-pro';

    const prompt = `
        **SIMULATION PARAMETERS:**
        We are conducting a "Red Team" wargame simulation.
        
        **BLUE TEAM (Defense):**
        - Narrative to Counter: "${narrative.title}"
        - Proposed Counter Tactic: "${counter.tactic}"
        - Execution Plan Summary: "${actionPlan.substring(0, 500)}..."

        **RED TEAM (Adversary):**
        - Profile: ${narrative.attribution?.suspectedOrigin || "Hostile Actor"}
        - Current TTPs: ${narrative.disarmAnalysis?.tactics.join(', ')}
        - Goal: Maximize harm and veracity of the original narrative.

        **TASK:**
        Simulate 2 rounds of interaction.
        1. Blue Team executes the plan.
        2. Red Team reacts to the Blue Team's move.
        3. Blue Team adjusts.
        4. Red Team reacts again.

        Analyze the likely public perception and risk score changes at each step.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: "application/json",
                responseSchema: wargameSchema,
                temperature: 0.7,
            }
        });

        return extractJson(response.text) as SimulationResult;
    } catch (error) {
        console.error("Error running wargame simulation:", error);
        throw new Error("Failed to run wargame simulation.");
    }
};

export const generateAllianceBrief = async (narrative: Narrative): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `
        You are a senior communications expert tasked with briefing trusted partners in the 'Signal Alliance' to counter a hostile information operation.

        Based on the following intelligence report, generate a concise mission brief (approx. 300 words). The brief must be structured with these four sections, each clearly titled with markdown bolding (e.g., **Overview**):

        1.  **Overview:** A summary of the hostile narrative and its immediate risk based on the DMMI Matrix Cube (Harm, Veracity, Probability).
        2.  **Key Message:** The core, truthful message our alliance should amplify to counter the narrative.
        3.  **Talking Points:** 3-4 specific, easy-to-use points that support the key message.
        4.  **Objective:** The primary goal of this counter-operation (e.g., "Inoculate the public against this falsehood," "Correct the record with verified facts," "Reduce the narrative's virality by 50%").

        **Intelligence Report:**
        - **Narrative Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **DMMI Assessment:** ${narrative.dmmiReport?.classification} with ${narrative.dmmiReport?.intent} intent. 
        - **Matrix Cube Scores:** Harm: ${narrative.dmmiReport?.harmScore}/10, Veracity: ${narrative.dmmiReport?.veracityScore}/10, Probability: ${narrative.dmmiReport?.probabilityScore}/10.
        - **Rationale:** ${narrative.dmmiReport?.rationale}
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

export const createNarrativeChat = (narrative: Narrative): Chat => {
    const postSummary = narrative.posts?.slice(0, 10).map(p => `- ${p.author}: ${p.content}`).join('\n') || "No posts available.";
    
    const systemInstruction = `
        You are the "Analyst Copilot" for OpenNarrative, an advanced defense tool against information operations.
        You are assisting a human intelligence analyst who is investigating a specific hostile narrative.
        
        **Narrative Intelligence Context:**
        - **Title:** "${narrative.title}"
        - **Summary:** "${narrative.summary}"
        - **Matrix Risk Score:** ${narrative.dmmiReport?.matrixRiskScore}/10
        - **DMMI Cube Profile:** Veracity: ${narrative.dmmiReport?.veracityScore}/10, Harm: ${narrative.dmmiReport?.harmScore}/10, Probability: ${narrative.dmmiReport?.probabilityScore}/10.
        - **DMMI Classification:** ${narrative.dmmiReport?.classification} (${narrative.dmmiReport?.intent}, ${narrative.dmmiReport?.veracity})
        - **DISARM Strategy:** Phase: ${narrative.disarmAnalysis?.phase}, Tactics: ${narrative.disarmAnalysis?.tactics.join(', ')}
        - **Attribution:** Suspected Origin: ${narrative.attribution?.suspectedOrigin}, Network Dynamics: ${narrative.attribution?.networkDynamics}
        - **Recent Posts Context:**
        ${postSummary}

        **Your Role:**
        1. Answer questions about the narrative's structure, key actors, and potential impact.
        2. Help draft counter-messaging or debunking content based on the verified facts (or lack thereof).
        3. Explain complex DMMI or DISARM concepts in the context of this specific narrative.
        4. Be concise, professional, and operationally focused. Do not lecture; provide actionable intelligence.
    `;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
            temperature: 0.4,
        }
    });
};
