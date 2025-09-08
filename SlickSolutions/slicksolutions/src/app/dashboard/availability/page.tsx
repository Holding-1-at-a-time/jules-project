'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useState } from 'react';

export default function AvailabilityPage() {
  const me = useQuery(api.users.me);
  const detailer = useQuery(api.users.getDetailer, me ? { userId: me._id } : 'skip');

  const availability = useQuery(
    api.availability.getAvailability,
    detailer ? { detailerId: detailer._id, date: new Date().toISOString().slice(0, 10) } : 'skip'
  );

  const setAvailability = useMutation(api.availability.setAvailability);

  const [newAvailability, setNewAvailability] = useState([
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // Monday
  ]);

  const handleSetAvailability = () => {
    if (!detailer) {
        alert('You must be a detailer to set availability.');
        return;
    }
    setAvailability({
      detailerId: detailer._id,
      availability: newAvailability,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Your Availability</h1>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Your Current Schedule</h2>
        <pre>{JSON.stringify(availability, null, 2)}</pre>
      </div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Set New Schedule</h2>
        {/* A form to edit the newAvailability state would go here */}
        <button
          onClick={handleSetAvailability}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Save Schedule
        </button>
      </div>
    </div>
  );
}
