'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface SubmitReviewFormProps {
  tenantId: Id<'tenants'>;
  clientId: Id<'clients'>;
  detailerId: Id<'detailers'>;
  assessmentId: Id<'assessments'>;
}

export default function SubmitReviewForm({
  tenantId,
  clientId,
  detailerId,
  assessmentId,
}: SubmitReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submitReview = useMutation(api.reviews.submitReview);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitReview({
      tenantId,
      clientId,
      detailerId,
      assessmentId,
      rating,
      comment,
    });
    setRating(5);
    setComment('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-gray-700">
          Rating
        </label>
        <input
          type="number"
          id="rating"
          name="rating"
          min="1"
          max="5"
          value={rating}
          onChange={(e) => setRating(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          Comment
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Submit Review
      </button>
    </form>
  );
}
