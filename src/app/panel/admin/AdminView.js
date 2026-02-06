// src/app/panel/admin/AdminView.js
'use client'

import { useState } from 'react';
import { createService, deleteService, approveUser, rejectUser, toggleUserStatus, deleteUser } from '@/actions/admin-actions';

export default function AdminView({ stats, pendingPros, allUsers, services, appointments }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPro, setSelectedPro] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* --- MODAL DE DETALLES DEL PROFESIONAL --- */}
      {selectedPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Cabecera del Modal */}
            <div className="bg-gray-50 border-b px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Ficha del Candidato</h3>
              <button 
                onClick={() => setSelectedPro(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal (Con Scroll) */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              
              {/* Encabezado del Perfil */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl shadow-inner text-blue-600">
                  🩺
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPro.name}</h2>
                  <p className="text-gray-500">{selectedPro.email}</p>
                </div>
              </div>

              {/* Grid de Datos Clave */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border hover:border-blue-200 transition-colors">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Especialidad</p>
                  <p className="font-medium text-gray-900">{selectedPro.professionalProfile?.specialty || 'No especificada'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border hover:border-blue-200 transition-colors">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Nº Matrícula / Licencia</p>
                  <p className="font-medium text-blue-700 font-mono">
                    {selectedPro.professionalProfile?.licenseNumber || 'Pendiente'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border hover:border-blue-200 transition-colors">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Teléfono</p>
                  <p className="font-medium text-gray-900">{selectedPro.professionalProfile?.phone || 'No registrado'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border hover:border-blue-200 transition-colors">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Experiencia</p>
                  <p className="font-medium text-gray-900">{selectedPro.professionalProfile?.experience || 0} años</p>
                </div>
              </div>

              {/* Biografía */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider">Biografía / Presentación</p>
                <p className="text-gray-700 italic leading-relaxed">
                  "{selectedPro.professionalProfile?.bio || 'El candidato no ha escrito una biografía.'}"
                </p>
              </div>

              {/* --- ZONA DE DOCUMENTACIÓN --- */}
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📁 Documentación Adjunta
                </h4>
                <div className="flex gap-3">
                    {selectedPro.professionalProfile?.cvUrl ? (
                        <a 
                            href={selectedPro.professionalProfile.cvUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 hover:border-blue-300 transition-all font-medium group"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
                            <span>Ver Curriculum Vitae (PDF)</span>
                            <span className="text-xs ml-1 opacity-60">↗</span>
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 text-gray-400 rounded-lg border border-gray-100 w-full italic">
                            <span>🚫 Sin CV adjunto</span>
                        </div>
                    )}
                </div>
              </div>

            </div>

            {/* Pie del Modal (Acciones) */}
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setSelectedPro(null)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              
              {/* BOTÓN RECHAZAR (NUEVO) */}
              <form action={async () => {
                  if(confirm('¿Estás seguro de RECHAZAR esta solicitud? Se enviará un correo y se eliminará el registro.')) {
                    await rejectUser(selectedPro.id);
                    setSelectedPro(null);
                  }
              }}>
                <button className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 border border-red-200 transition-colors">
                  Rechazar
                </button>
              </form>

              {/* BOTÓN APROBAR */}
              <form action={async () => {
                  await approveUser(selectedPro.id);
                  setSelectedPro(null); 
              }}>
                <button className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transform active:scale-95 transition-all flex items-center gap-2">
                  ✅ Aprobar Profesional
                </button>
              </form>
            </div>

          </div>
        </div>
      )}


      {/* Sidebar / Tabs Navegación */}
      <div className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex gap-6 overflow-x-auto shadow-sm">
        {['dashboard', 'usuarios', 'servicios', 'citas'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`capitalize pb-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
            >
                {tab}
            </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        
        {/* VISTA: DASHBOARD */}
        {activeTab === 'dashboard' && (
            <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard label="Usuarios Totales" value={stats.totalUsers} icon="👥" />
                    <StatCard label="Profesionales" value={stats.totalPros} icon="🩺" />
                    <StatCard label="Citas Agendadas" value={stats.totalAppts} icon="📅" />
                    <StatCard label="Ingresos (Est.)" value={`$${stats.revenue}`} icon="💰" />
                </div>

                {/* Pendientes de Aprobación */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100">
                    <h3 className="font-bold text-lg mb-4 text-orange-800 flex items-center gap-2">
                      ⚠️ Requieren Aprobación ({pendingPros.length})
                    </h3>
                    
                    {pendingPros.length === 0 ? <p className="text-gray-400">Todo al día.</p> : (
                        <div className="space-y-3">
                            {pendingPros.map(u => (
                                <div key={u.id} className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-100 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-10 bg-orange-200 rounded-full flex items-center justify-center text-orange-700 font-bold shrink-0">
                                        {u.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className="font-bold text-gray-800">{u.name}</p>
                                          <p className="text-xs text-gray-500">{u.email}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <button 
                                          onClick={() => setSelectedPro(u)}
                                          className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                      >
                                          👁️ Ver Ficha
                                      </button>
                                      
                                      {/* BOTÓN RECHAZAR RÁPIDO (NUEVO) */}
                                      <form action={async () => {
                                          if(confirm(`¿Rechazar a ${u.name}? Esta acción enviará un correo y borrará la solicitud.`)) {
                                              await rejectUser(u.id);
                                          }
                                      }}>
                                          <button className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors" title="Rechazar solicitud">
                                              ✕
                                          </button>
                                      </form>

                                      <button 
                                          onClick={() => approveUser(u.id)}
                                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-colors"
                                      >
                                          Aprobar
                                      </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* VISTA: USUARIOS */}
        {activeTab === 'usuarios' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                                <th className="p-4">Usuario</th>
                                <th className="p-4">Rol</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.map(user => (
                                <tr key={user.id} className="border-t hover:bg-gray-50">
                                    <td className="p-4">
                                        <p className="font-medium">{user.name}</p>
                                        <p className="text-xs text-gray-500">{user.email}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'PROFESSIONAL' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {user.isActive ? <span className="text-green-600">Activo</span> : <span className="text-red-500">Bloqueado</span>}
                                    </td>
                                    <td className="p-4 text-right gap-2 flex justify-end">
                                        <button onClick={() => toggleUserStatus(user.id, user.isActive)} className="text-blue-600 hover:underline">
                                            {user.isActive ? 'Bloquear' : 'Activar'}
                                        </button>
                                        <button onClick={() => deleteUser(user.id)} className="text-red-600 hover:underline ml-2">
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* VISTA: SERVICIOS */}
        {activeTab === 'servicios' && (
            <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm h-fit">
                    <h3 className="font-bold mb-4">Nuevo Servicio</h3>
                    <form action={createService} className="space-y-4">
                        <input name="title" placeholder="Nombre (ej. Terapia Pareja)" className="w-full border p-2 rounded" required />
                        <div className="flex gap-2">
                            <input name="price" type="number" placeholder="Precio ($)" className="w-full border p-2 rounded" required />
                            <input name="duration" type="number" placeholder="Minutos" className="w-full border p-2 rounded" required />
                        </div>
                        <textarea name="description" placeholder="Descripción breve..." className="w-full border p-2 rounded"></textarea>
                        <button className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Crear Servicio</button>
                    </form>
                </div>

                <div className="md:col-span-2 space-y-4">
                    {services.map(s => (
                        <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-lg">{s.title}</h4>
                                <p className="text-sm text-gray-500">{s.durationMin} min • ${s.price}</p>
                            </div>
                            <button onClick={() => deleteService(s.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VISTA: CITAS */}
        {activeTab === 'citas' && (
            <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold mb-4">Historial de Citas Global</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="pb-2">Fecha</th>
                                <th className="pb-2">Paciente</th>
                                <th className="pb-2">Profesional</th>
                                <th className="pb-2">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(app => (
                                <tr key={app.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-3">{new Date(app.date).toLocaleDateString()}</td>
                                    <td className="py-3 font-medium">{app.patient?.name || 'Anon'}</td>
                                    <td className="py-3 text-blue-600">{app.professional?.user?.name}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${app.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {app.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="text-3xl">{icon}</div>
            <div>
                <p className="text-gray-500 text-xs uppercase font-bold">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    )
}