import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Settings as SettingsIcon } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceKes: number;
  isActive: boolean;
  sortOrder: number;
}

export default function Settings() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Service>>({});

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await api.get("/services");
      setServices(response.data);
    } catch (err) {
      console.error("Failed to fetch services", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (id: string) => {
    try {
      await api.patch(`/services/${id}`, editForm);
      setEditing(null);
      fetchServices();
    } catch (err) {
      console.error("Failed to update service", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Salon Services</h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
        ) : services.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">No services configured</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {services.map((service) => (
              <div key={service.id} className="px-6 py-4">
                {editing === service.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.name ?? service.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Service name"
                    />
                    <div className="flex gap-4">
                      <input
                        type="number"
                        value={editForm.durationMinutes ?? service.durationMinutes}
                        onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Duration (min)"
                      />
                      <input
                        type="number"
                        value={editForm.priceKes ?? service.priceKes}
                        onChange={(e) => setEditForm({ ...editForm, priceKes: Number(e.target.value) })}
                        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Price (KES)"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(service.id)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-500">{service.durationMinutes} min — KES {service.priceKes.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${service.isActive ? "text-green-600" : "text-red-600"}`}>
                        {service.isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        onClick={() => {
                          setEditing(service.id);
                          setEditForm({ name: service.name, durationMinutes: service.durationMinutes, priceKes: service.priceKes });
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}