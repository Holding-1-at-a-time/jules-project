'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface ThemeCustomizerProps {
  tenantId: Id<'tenants'>;
}

export default function ThemeCustomizer({ tenantId }: ThemeCustomizerProps) {
  const theme = useQuery(api.themes.getTheme, { tenantId });
  const saveTheme = useMutation(api.themes.saveTheme);

  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#cccccc');

  useEffect(() => {
    if (theme) {
      setPrimaryColor(theme.primaryColor);
      setSecondaryColor(theme.secondaryColor);
    }
  }, [theme]);

  const handleSaveTheme = () => {
    saveTheme({ tenantId, primaryColor, secondaryColor });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Theme Customizer</h2>
      <div className="flex items-center space-x-4">
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">
            Primary Color
          </label>
          <input
            type="color"
            id="primaryColor"
            name="primaryColor"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700">
            Secondary Color
          </label>
          <input
            type="color"
            id="secondaryColor"
            name="secondaryColor"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>
      <button
        onClick={handleSaveTheme}
        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Save Theme
      </button>
    </div>
  );
}
