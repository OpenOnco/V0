// Simple Chat API Endpoint for OpenOnco
// Pass-through to Anthropic API

import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if API key exists
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY environment variable is not set');
      return res.status(500).json({ 
        error: 'API key not configured',
        hint: 'Set ANTHROPIC_API_KEY in Vercel environment variables'
      });
    }
    
    // Log key prefix for debugging (safe - only shows first 10 chars)
    console.log('API key found, starts with:', apiKey.substring(0, 10) + '...');

    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    console.log('Creating Anthropic client...');
    const client = new Anthropic({ apiKey });

    console.log('Calling API with model:', model || 'claude-haiku-3-5-20241022');
    const response = await client.messages.create({
      model: model || 'claude-haiku-3-5-20241022',
      max_tokens: max_tokens || 1024,
      system: system || '',
      messages: messages
    });

    console.log('API call successful');
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Chat API error:', error.message);
    console.error('Error type:', error.constructor.name);
    console.error('Error status:', error.status);
    
    // Return more details to help debug
    return res.status(500).json({ 
      error: 'An error occurred',
      message: error.message,
      type: error.constructor.name
    });
  }
}
