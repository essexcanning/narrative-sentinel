import { AnalysisInput, Post, SearchSource } from '../types';

// Define the structure of the Twitter API v2 response for type safety
interface TwitterMedia {
    media_key: string;
    type: 'photo' | 'video' | 'animated_gif';
    url?: string; // For photos
    preview_image_url?: string; // For videos
}

interface TweetAttachment {
    media_keys: string[];
}

interface TwitterApiResponse {
    data?: {
        id: string;
        text: string;
        created_at: string;
        author_id: string;
        attachments?: TweetAttachment;
    }[];
    includes?: {
        users?: {
            id: string;
            name: string;
            username: string;
        }[];
        media?: TwitterMedia[];
    };
    meta: {
        result_count: number;
    };
    errors?: any[];
}


/**
 * Fetches recent tweets based on the analysis inputs.
 * 
 * IMPORTANT: This function is designed to call a backend proxy.
 * Directly calling the Twitter API from the frontend would expose your Bearer Token,
 * which is a major security risk. It would also be blocked by browser CORS policy.
 * 
 * @param inputs The user's analysis parameters.
 * @returns A promise that resolves to posts and sources from Twitter.
 */
export const fetchTwitterPosts = async (inputs: AnalysisInput): Promise<{ posts: Post[], sources: SearchSource[] }> => {
    // Construct the query for the backend proxy.
    // Since the user no longer provides a topic, we search for broad, high-signal keywords related to news and public discourse.
    const query = `("top stories" OR "breaking news" OR "headlines" OR "public debate") lang:en -is:retweet`;
    const encodedQuery = encodeURIComponent(query);
    const countryCode = await getCountryCode(inputs.country); // Helper to get 2-letter code
    
    const twitterFields = 'tweet.fields=created_at,attachments&expansions=author_id,attachments.media_keys&user.fields=name,username&media.fields=type,url,preview_image_url';
    const apiUrl = `/api/twitter-search?query=${encodedQuery}&country=${countryCode}&fields=${encodeURIComponent(twitterFields)}`;

    try {
        const response = await fetch(apiUrl);
        
        // Specifically handle 404 for missing dev proxy without throwing a critical error
        if (response.status === 404) {
            console.warn(
                "Twitter API proxy returned a 404. This is expected if the backend proxy is not set up. Skipping Twitter source."
            );
            return { posts: [], sources: [] };
        }

        if (!response.ok) {
            const errorData = await response.text(); // Use .text() in case of non-JSON error response
            throw new Error(`Twitter API proxy failed with status ${response.status}: ${errorData}`);
        }
        
        const data: TwitterApiResponse = await response.json();

        if (data.errors) {
            console.error('Twitter API returned errors:', data.errors);
            throw new Error('The Twitter API returned an error.');
        }

        const users = new Map(data.includes?.users?.map(u => [u.id, u]));
        const media = new Map(data.includes?.media?.map(m => [m.media_key, m]));

        const posts: Post[] = (data.data || []).map((tweet) => {
            const author = users.get(tweet.author_id);
            const tweetUrl = `https://twitter.com/${author?.username || 'anyuser'}/status/${tweet.id}`;
            let imageUrl: string | undefined;
            let videoUrl: string | undefined;

            if (tweet.attachments?.media_keys && tweet.attachments.media_keys.length > 0) {
                const mediaKey = tweet.attachments.media_keys[0];
                const mediaObject = media.get(mediaKey);

                if (mediaObject) {
                    if (mediaObject.type === 'photo' && mediaObject.url) {
                        imageUrl = mediaObject.url;
                    } else if (mediaObject.type === 'video' && mediaObject.preview_image_url) {
                        // We use the thumbnail as the imageUrl for videos, as we analyze the image.
                        imageUrl = mediaObject.preview_image_url;
                        videoUrl = tweetUrl; // The video itself is at the tweet URL
                    }
                }
            }

            return {
                id: `twitter_${tweet.id}`,
                source: 'Twitter' as const,
                author: author ? `${author.name} (@${author.username})` : 'Unknown User',
                content: tweet.text,
                timestamp: new Date(tweet.created_at).toISOString().split('T')[0],
                link: tweetUrl,
                imageUrl,
                videoUrl,
            };
        });

        const sources: SearchSource[] = posts.map(p => ({
            uri: p.link,
            title: `Tweet by ${p.author}: "${p.content.substring(0, 50)}..."`
        }));

        return { posts, sources };

    } catch (error) {
        console.error("Error fetching or parsing data from Twitter proxy:", error);
        // For development, if the proxy doesn't exist or returns an error (e.g., non-JSON),
        // we return empty arrays to avoid crashing the entire analysis pipeline.
        console.warn(
            "Could not process Twitter data. This could be a network issue or an invalid response from the proxy. Returning empty results for Twitter."
        );
        return { posts: [], sources: [] };
    }
};


// Simple helper to find a country code (in a real app, this might be a more robust library)
const getCountryCode = async (countryName: string): Promise<string> => {
    // In a real app, you would use a library or a more comprehensive mapping.
    // For this example, we'll use a simplified mapping.
    const countryMap: { [key: string]: string } = {
        'United States': 'US',
        'United Kingdom': 'GB',
        'Canada': 'CA',
        'Moldova': 'MD',
        'Ukraine': 'UA',
        'Russia': 'RU',
    };
    return countryMap[countryName] || 'US';
}


/*
================================================================================
== BACKEND PROXY CODE EXAMPLE (for developer handover) ==
================================================================================
To make this service work, you must deploy a backend function (e.g., a Node.js 
serverless function) that handles the API request securely. The following is an
example for Vercel, but the logic is similar for Netlify, Google Cloud Functions, etc.

--- INSTRUCTIONS ---
1.  DO NOT store API keys in your code.
2.  Go to your hosting provider's dashboard (e.g., Vercel Project Settings).
3.  Find the "Environment Variables" section.
4.  Add the following secrets:
    - Name: TWITTER_BEARER_TOKEN,  Value: [Your Twitter Bearer Token]

5.  Deploy the code below as a serverless function at the path `/api/twitter-search`.
    The frontend now sends a generic query and specific field requirements, which this
    proxy will pass to the Twitter API.

--------------------------------------------------------------------------------
// File: /api/twitter-search.js (Example using Vercel Edge Functions syntax)

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const country = searchParams.get('country');
  const fields = searchParams.get('fields'); // Frontend now passes required fields

  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Add country to the query if provided. This helps narrow the search to the region of interest.
  const fullQuery = country ? `${query} place_country:${country}` : query;

  // Securely access the Bearer Token from environment variables.
  const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

  if (!TWITTER_BEARER_TOKEN) {
     return new Response(JSON.stringify({ error: 'Server misconfiguration: Twitter token not set.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const twitterApiParams = fields || 'tweet.fields=created_at&expansions=author_id&user.fields=name,username';
  const twitterApiUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(fullQuery)}&${twitterApiParams}&max_results=50`;

  try {
    const twitterResponse = await fetch(twitterApiUrl, {
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!twitterResponse.ok) {
      const errorData = await twitterResponse.json();
      return new Response(JSON.stringify({ error: 'Failed to fetch data from Twitter', details: errorData }), {
        status: twitterResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await twitterResponse.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=60' // Cache for 2 minutes
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
--------------------------------------------------------------------------------
*/