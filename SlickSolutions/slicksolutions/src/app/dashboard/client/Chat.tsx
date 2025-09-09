'use client';

import { useQuery, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { FormEvent, useState, useRef, useEffect } from 'react';
import { Id } from '../convex/_generated/dataModel';

interface ChatProps {
  clientId: Id<'clients'>;
  tenantId: Id<'tenants'>;
}

/**
 * Chat UI component that displays and sends messages between a user and an AI assistant.
 *
 * Renders a scrollable chat history for the given client and a text input to send new messages.
 * Fetches conversation history via a query and dispatches messages through a Convex action.
 * Automatically scrolls to the newest message when history updates. While sending, input and
 * submit button are disabled. Errors from the send action are not handled inside the component.
 *
 * @param clientId - Identifier of the client whose chat history to load.
 * @param tenantId - Identifier of the tenant context for sending messages.
 * @returns The chat UI as a JSX element.
 */
export default function Chat({ clientId, tenantId }: ChatProps) {
  const chatHistory = useQuery(api.chat.getForClient, { clientId });
  const chatAction = useAction(api.ai.customerConcierge.chat);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [chatHistory]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() === '') return;

    setIsSending(true);
    await chatAction({
      clientId,
      tenantId,
      message,
    });
    setMessage('');
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg shadow-lg">
      <h2 className="text-xl font-bold p-4 border-b">Chat with our AI Assistant</h2>
      <div className="flex-1 p-4 overflow-y-auto">
        {chatHistory?.map((chat) => (
          <div key={chat._id} className={`flex ${chat.from === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`rounded-lg px-4 py-2 ${chat.from === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              <p className="text-sm">{chat.message}</p>
              <p className="text-xs text-right mt-1 opacity-75">
                {new Date(chat.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t flex">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message..."
          disabled={isSending}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-r-lg disabled:bg-blue-300"
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
