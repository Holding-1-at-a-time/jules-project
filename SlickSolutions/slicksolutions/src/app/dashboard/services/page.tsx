'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import Link from 'next/link';

export default function ServicesPage() {
  const me = useQuery(api.users.me);
  const services = useQuery(
    api.services.getForTenant,
    me && me.tenantId ? { tenantId: me.tenantId } : 'skip'
  );

  const detailers = useQuery(
    api.users.getDetailersByTenant,
    me && me.tenantId ? { tenantId: me.tenantId } : 'skip'
  );

  // For simplicity, we'll use the first detailer for all services.
  const defaultDetailerId = detailers?.[0]?._id;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Our Services</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services ? (
          services.map((service) => (
            <div key={service._id} className="border p-4 rounded-lg flex flex-col">
              <h2 className="text-xl font-semibold">{service.name}</h2>
              <p className="text-gray-600 flex-grow">{service.description}</p>
              <p className="text-lg font-bold mt-2">${service.basePrice}</p>
              <p className="text-sm text-gray-500">Duration: {service.duration} minutes</p>
              {defaultDetailerId && (
                <Link href={`/book-appointment?serviceId=${service._id}&detailerId=${defaultDetailerId}`}>
                  <span className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4 inline-block text-center">
                    Book Now
                  </span>
                </Link>
              )}
            </div>
          ))
        ) : (
          <p>Loading services...</p>
        )}
      </div>
    </div>
  );
}
