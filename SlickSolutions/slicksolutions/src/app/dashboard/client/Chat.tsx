'use client';

import { useQuery, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { FormEvent, useState } from 'react';
import { Id } from '../../../../convex/_generated/dataModel';

interface ChatProps {
  clientId: Id<'clients'>;
  tenantId: Id<'tenants'>;
}

export default function Chat({ clientId, tenantId }: ChatProps) {
  const chatHistory = useQuery(api.chat.getForClient, { clientId });
  const chatAction = useAction(api.ai.customerConcierge.chat);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() === '') return;

    chatAction({
      clientId,
      tenantId,
      message,
    });

    setMessage('');
  };

  return (
    <div>
      <h2>Chat with our AI Assistant</h2>
      <div>
        {chatHistory?.map((chat, index) => (
          <div key={index}>
            <strong>{chat.from}:</strong> {chat.message}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
