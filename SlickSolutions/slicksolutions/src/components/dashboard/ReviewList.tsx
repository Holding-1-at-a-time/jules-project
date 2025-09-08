'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface ReviewListProps {
  detailerId: Id<'detailers'>;
}

export default function ReviewList({ detailerId }: ReviewListProps) {
  const reviews = useQuery(api.reviews.getDetailerReviews, { detailerId });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Reviews</h2>
      {reviews ? (
        <ul className="divide-y divide-gray-200">
          {reviews.map((review) => (
            <li key={review._id} className="py-4">
              <div className="flex space-x-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Rating: {review.rating}/5</h3>
                  </div>
                  <p className="text-sm text-gray-500">{review.comment}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Loading reviews...</p>
      )}
    </div>
  );
}
