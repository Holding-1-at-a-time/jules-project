'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BookAppointmentPage() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('serviceId');
  const detailerId = searchParams.get('detailerId');

  const me = useQuery(api.users.me);
  const client = useQuery(api.users.getClient, me ? { userId: me._id } : 'skip');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const availableSlots = useQuery(
    api.appointments.getAvailableSlots,
    serviceId && detailerId ? { serviceId, detailerId, date: selectedDate } : 'skip'
  );

  const service = useQuery(api.services.get, serviceId ? { id: serviceId } : 'skip');

  const bookAppointment = useMutation(api.appointments.bookAppointment);

  const handleBookAppointment = (slot: string) => {
    if (!client || !detailerId || !serviceId || !service) {
        alert('You must be logged in as a client to book an appointment, and detailer/service must be selected.');
        return;
    }
    const startTime = new Date(`${selectedDate}T${slot}:00Z`).getTime();
    const endTime = startTime + service.duration * 60 * 1000;

    bookAppointment({
      detailerId: detailerId,
      clientId: client._id,
      serviceId: serviceId,
      startTime,
      endTime,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Book an Appointment</h1>
      <div className="mb-4">
        <label htmlFor="date-select" className="mr-2">Select a date:</label>
        <input
          type="date"
          id="date-select"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Available Slots for {selectedDate}</h2>
        {availableSlots ? (
          <div className="flex flex-wrap">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => handleBookAppointment(slot)}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-2"
              >
                {slot}
              </button>
            ))}
          </div>
        ) : (
          <p>Loading available slots...</p>
        )}
      </div>
    </div>
  );
}
