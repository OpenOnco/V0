// Simple Chat API Endpoint for OpenOnco
// Pass-through to Anthropic API (matches old working App.jsx format)

import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: model || 'claude-haiku-3-5-20241022',
      max_tokens: max_tokens || 1024,
      system: system || '',
      messages: messages
    });

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Service temporarily unavailable' });
    }
    
    return res.status(500).json({ error: 'An error occurred' });
  }
}
