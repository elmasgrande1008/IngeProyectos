import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, RefreshCw, Users, Plus, Mail, FileText, Settings, 
  Clock, Zap, CheckCircle, X, Paperclip, GripVertical, User
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, 
  deleteDoc, serverTimestamp 
} from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE (Tus credenciales reales) ---
const firebaseConfig = {
  apiKey: "AIzaSyDfgXGKVmKVANuBTfSQUiewXZGJDKddbrc",
  authDomain: "ingeproyectos-db.firebaseapp.com",
  projectId: "ingeproyectos-db",
  storageBucket: "ingeproyectos-db.firebasestorage.app",
  messagingSenderId: "373822102571",
  appId: "1:373822102571:web:b4046fbc2746db48dfde6e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Datos iniciales de ejemplo
const INITIAL_TEAM = [
  { id: '1', name: 'Ana Ruiz', role: 'Coordinadora', color: '#ef4444', initials: 'AR' },
  { id: '2', name: 'Carlos Mendez', role: 'Ingeniero Senior', color: '#0ea5e9', initials: 'CM' },
  { id: '3', name: 'Diego Torres', role: 'Proyectista', color: '#f59e0b', initials: 'DT' },
  { id: '4', name: 'Laura Gomez', role: 'Ingeniera Civil', color: '#10b981', initials: 'LG' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  
  // Modals state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  
  // New Project Form State
  const [droppedFile, setDroppedFile] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  // --- INICIALIZACIÓN Y SINCRONIZACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Suscribirse a Proyectos
    const projectsRef = collection(db, 'projects');
    const unsubscribeProjects = onSnapshot(projectsRef, (snapshot) => {
      const projData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(projData.sort((a, b) => b.number - a.number));
    }, (error) => console.error("Error cargando proyectos:", error));

    // Suscribirse al Equipo
    const teamRef = collection(db, 'team');
    const unsubscribeTeam = onSnapshot(teamRef, (snapshot) => {
      if (snapshot.empty) {
        // Inicializar equipo si está vacío en la base de datos
        INITIAL_TEAM.forEach(member => {
          setDoc(doc(teamRef, member.id), member);
        });
      } else {
        const teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTeam(teamData);
      }
    }, (error) => console.error("Error cargando equipo:", error));

    return () => {
      unsubscribeProjects();
      unsubscribeTeam();
    };
  }, [user]);

  // --- FUNCIONES DE BASE DE DATOS ---
  const getNextProjectNumber = () => {
    if (projects.length === 0) return 1;
    return Math.max(...projects.map(p => p.number)) + 1;
  };

  const handleSaveProject = async (projectData) => {
    if (!user) return;
    const isNew = !projectData.id;
    const docId = isNew ? crypto.randomUUID() : projectData.id;
    
    const finalData = {
      ...projectData,
      id: docId,
      number: isNew ? getNextProjectNumber() : projectData.number,
      updatedAt: serverTimestamp(),
      ...(isNew && { createdAt: serverTimestamp() })
    };

    try {
      const projRef = doc(db, 'projects', docId);
      await setDoc(projRef, finalData, { merge: true });
      setIsNewProjectModalOpen(false);
      setDroppedFile(null);
      setEditingProject(null);
    } catch (error) {
      console.error("Error guardando proyecto:", error);
    }
  };

  const handleUpdateProjectStatus = async (projectId, newStatus) => {
    if (!user) return;
    try {
      const projRef = doc(db, 'projects', projectId);
      await updateDoc(projRef, { status: newStatus, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!user) return;
    if (window.confirm("¿Estás seguro de eliminar este proyecto?")) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (error) {
        console.error("Error eliminando:", error);
      }
    }
  };

  // --- DRAG AND DROP GENERAL ---
  const onMainDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setDroppedFile(file);
      setEditingProject(null);
      setIsNewProjectModalOpen(true);
    }
  };

  // Contadores
  const counts = {
    inicio: projects.filter(p => p.status === 'inicio').length,
    desarrollo: projects.filter(p => p.status === 'desarrollo').length,
    terminado: projects.filter(p => p.status === 'terminado').length,
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p>Conectando con la base de datos...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans" onDragOver={(e) => e.preventDefault()} onDrop={onMainDrop}>
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500 p-2.5 rounded-xl text-white shadow-md shadow-cyan-500/20">
            <FolderOpen size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">IngeProyectos</h1>
            <p className="text-sm text-slate-400">Gestión de consultas y proyectos</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2 text-sm font-medium">
            <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full flex gap-2 items-center">
              <span className="font-bold">{projects.length}</span> proyectos
            </span>
            <span className="bg-yellow-50 text-yellow-600 px-4 py-1.5 rounded-full flex gap-2 items-center border border-yellow-100">
              <span className="font-bold">{counts.desarrollo}</span> en desarrollo
            </span>
            <span className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full flex gap-2 items-center border border-green-100">
              <span className="font-bold">{counts.terminado}</span> terminados
            </span>
          </div>

          <div className="flex gap-3 border-l pl-4">
            <button onClick={() => {}} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium shadow-sm"
            >
              <Users size={18} />
              Equipo
            </button>
            <button 
              onClick={() => { setDroppedFile(null); setEditingProject(null); setIsNewProjectModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-medium shadow-md shadow-cyan-500/20"
            >
              <Plus size={18} />
              Nuevo
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-6 max-w-[1600px] mx-auto">
        {/* Drop Zone Banner */}
        <div className="mb-8 border-2 border-dashed border-slate-200 bg-white/50 rounded-xl p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-600 transition-all cursor-pointer group">
          <Mail className="opacity-50 group-hover:opacity-100 transition-opacity" size={24} />
          <p className="font-medium">Arrastra correos (.eml/.msg) o archivos PDF aquí para crear un nuevo proyecto automáticamente</p>
          <button 
            onClick={() => { setDroppedFile(null); setEditingProject(null); setIsNewProjectModalOpen(true); }}
            className="text-cyan-500 font-semibold mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={16} /> Crear manualmente
          </button>
        </div>

        {/* KANBAN BOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KanbanColumn 
            title="Inicio" 
            icon={<Clock size={18} />} 
            color="bg-slate-400" 
            status="inicio" 
            count={counts.inicio}
            projects={projects.filter(p => p.status === 'inicio')}
            onUpdateStatus={handleUpdateProjectStatus}
            onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
            team={team}
          />
          <KanbanColumn 
            title="En Desarrollo" 
            icon={<Zap size={18} />} 
            color="bg-yellow-400" 
            status="desarrollo" 
            count={counts.desarrollo}
            projects={projects.filter(p => p.status === 'desarrollo')}
            onUpdateStatus={handleUpdateProjectStatus}
            onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
            team={team}
          />
          <KanbanColumn 
            title="Terminado" 
            icon={<CheckCircle size={18} />} 
            color="bg-green-500" 
            status="terminado" 
            count={counts.terminado}
            projects={projects.filter(p => p.status === 'terminado')}
            onUpdateStatus={handleUpdateProjectStatus}
            onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
            team={team}
          />
        </div>
      </main>

      {/* MODALS */}
      {isNewProjectModalOpen && (
        <NewProjectModal 
          onClose={() => { setIsNewProjectModalOpen(false); setEditingProject(null); setDroppedFile(null); }} 
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          team={team}
          initialFile={droppedFile}
          editingProject={editingProject}
        />
      )}

      {isTeamModalOpen && (
        <TeamModal 
          onClose={() => setIsTeamModalOpen(false)} 
          team={team}
          db={db}
        />
      )}
    </div>
  );
}

// --- COMPONENTES SECUNDARIOS ---

function KanbanColumn({ title, icon, color, status, count, projects, onUpdateStatus, onEdit, team }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-slate-100');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-slate-100');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-slate-100');
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId) {
      onUpdateStatus(projectId, status);
    }
  };

  return (
    <div 
      className="flex flex-col bg-transparent rounded-xl transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
          <span className="text-slate-500">{icon}</span>
          <h2 className="font-semibold text-slate-700">{title} <span className="ml-2 bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{count}</span></h2>
        </div>
        <button className="text-slate-400 hover:text-slate-600"><Plus size={18} /></button>
      </div>

      <div className="flex-1 min-h-[200px] bg-slate-50/50 border border-slate-200 border-dashed rounded-xl p-3 flex flex-col gap-3">
        {projects.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
            Sin proyectos
          </div>
        ) : (
          projects.map(project => (
            <ProjectCard key={project.id} project={project} onEdit={onEdit} team={team} />
          ))
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, team }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('projectId', project.id);
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Alta': return 'bg-red-100 text-red-600 border-red-200';
      case 'Media': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'Baja': return 'bg-green-100 text-green-600 border-green-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const assignees = project.assignees || [];
  const assignedTeam = team.filter(t => assignees.includes(t.id));

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onClick={() => onEdit(project)}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-cyan-300 transition-all group relative"
    >
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-300 cursor-grab">
        <GripVertical size={16} />
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase">#{project.number}</span>
        {project.priority && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(project.priority)} uppercase tracking-wider`}>
            {project.priority}
          </span>
        )}
        {project.source === 'Correo' && <Mail size={12} className="text-slate-400" />}
        {project.source === 'PDF / Tecnico' && <FileText size={12} className="text-slate-400" />}
      </div>
      
      <h3 className="font-semibold text-slate-800 mb-1 leading-tight line-clamp-2">{project.title}</h3>
      
      {project.subject && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-1">{project.subject}</p>
      )}

      <div className="flex items-center justify-between mt-4">
        <div className="flex -space-x-2">
          {assignedTeam.length > 0 ? assignedTeam.map((member, i) => (
            <div 
              key={member.id} 
              title={member.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-sm"
              style={{ backgroundColor: member.color, zIndex: 10 - i }}
            >
              {member.initials}
            </div>
          )) : (
            <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400">
              <User size={12} />
            </div>
          )}
        </div>
        
        {project.attachments?.length > 0 && (
          <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
            <Paperclip size={12} /> {project.attachments.length}
          </div>
        )}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onSave, onDelete, team, initialFile, editingProject }) {
  const [sourceType, setSourceType] = useState('Manual');
  const [formData, setFormData] = useState({
    title: '',
    sender: '',
    subject: '',
    body: '',
    priority: 'Media',
    folderPath: '',
    assignees: [],
    attachments: [],
    status: 'inicio',
    number: null
  });

  useEffect(() => {
    if (editingProject) {
      setSourceType(editingProject.source || 'Manual');
      setFormData({
        ...editingProject,
        assignees: editingProject.assignees || [],
        attachments: editingProject.attachments || []
      });
    } else if (initialFile) {
      // Auto-fill base on file
      const name = initialFile.name;
      const isMail = name.endsWith('.msg') || name.endsWith('.eml');
      setSourceType(isMail ? 'Correo' : 'PDF / Tecnico');
      setFormData(prev => ({
        ...prev,
        title: name,
        attachments: [{ name, size: initialFile.size }]
      }));
    }
  }, [initialFile, editingProject]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleAssignee = (id) => {
    setFormData(prev => {
      const isAssigned = prev.assignees.includes(id);
      return {
        ...prev,
        assignees: isAssigned 
          ? prev.assignees.filter(a => a !== id)
          : [...prev.assignees, id]
      };
    });
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files.map(f => ({ name: f.name, size: f.size }))]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("El título es obligatorio");
      return;
    }
    onSave({ ...formData, source: sourceType });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-slate-800">
            {editingProject ? `Editar Proyecto #${editingProject.number}` : 'Nuevo Proyecto / Consulta'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="projectForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Source Type Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Origen</label>
              <div className="flex gap-2">
                {['Manual', 'Correo', 'PDF / Tecnico'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSourceType(type)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                      sourceType === type 
                        ? 'bg-cyan-500 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'Manual' && <Settings size={16} />}
                    {type === 'Correo' && <Mail size={16} />}
                    {type === 'PDF / Tecnico' && <FileText size={16} />}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Email specific fields */}
            {sourceType === 'Correo' && (
              <div className="bg-cyan-50/50 p-4 rounded-xl border border-cyan-100 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">De (remitente)</label>
                  <input type="text" name="sender" value={formData.sender} onChange={handleChange} placeholder="nombre@empresa.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Asunto</label>
                  <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Asunto del correo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cuerpo del correo (Opcional)</label>
                  <textarea name="body" value={formData.body} onChange={handleChange} rows="3" placeholder="Pegue el texto aquí o será parseado automáticamente..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-xs text-slate-600"></textarea>
                </div>
              </div>
            )}

            {/* Main Info */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Título del Proyecto *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="Ej: RV_ Carro bomba Albin + VLT" className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm" />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prioridad</label>
              <div className="flex gap-2">
                {['Alta', 'Media', 'Baja'].map(prio => (
                  <button
                    key={prio}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: prio }))}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      formData.priority === prio 
                        ? (prio === 'Alta' ? 'bg-red-500 text-white border-red-500' : prio === 'Media' ? 'bg-orange-500 text-white border-orange-500' : 'bg-green-500 text-white border-green-500')
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {prio}
                  </button>
                ))}
              </div>
            </div>

            {/* Folder Path */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FolderOpen size={14} /> Ruta de Carpeta Local (Opcional)
              </label>
              <input type="text" name="folderPath" value={formData.folderPath} onChange={handleChange} placeholder="Ej: C:\Proyectos\Ingenieria\ o /home/usuario/proyectos/" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono focus:ring-2 focus:ring-cyan-500 outline-none bg-slate-50" />
              <p className="text-[10px] text-slate-400 mt-1">* Ayuda a referenciar dónde están los archivos físicos de este proyecto.</p>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Asignar A</label>
              <div className="flex flex-wrap gap-2">
                {team.map(member => {
                  const isAssigned = formData.assignees.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleAssignee(member.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${
                        isAssigned ? 'border-cyan-500 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full text-[9px] text-white flex items-center justify-center font-bold" style={{ backgroundColor: member.color }}>
                        {member.initials}
                      </span>
                      <span className={isAssigned ? 'font-medium text-cyan-800' : 'text-slate-600'}>{member.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attachments Dropzone */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Archivos Adjuntos (Metadatos)</label>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <div className="text-slate-400 flex flex-col items-center gap-1">
                  <Paperclip size={20} />
                  <span className="text-sm">Arrastrar o click para registrar archivos</span>
                </div>
              </div>
              {formData.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      <span className="text-sm text-slate-600 truncate flex-1">{file.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                        <button type="button" onClick={() => setFormData(prev => ({...prev, attachments: prev.attachments.filter((_, i) => i !== idx)}))} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
          {editingProject ? (
            <button 
              type="button" 
              onClick={() => { onDelete(editingProject.id); onClose(); }}
              className="px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors text-sm"
            >
              Eliminar
            </button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="submit" form="projectForm" className="px-6 py-2.5 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 shadow-md shadow-cyan-500/20 transition-colors">
              {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function TeamModal({ onClose, team, db }) {
  const [newMember, setNewMember] = useState({ name: '', role: '', color: '#0ea5e9' });
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) return;
    const memberData = {
      id: crypto.randomUUID(),
      name: newMember.name,
      role: newMember.role,
      color: newMember.color,
      initials: getInitials(newMember.name)
    };
    
    try {
      await setDoc(doc(db, 'team', memberData.id), memberData);
      setNewMember({ name: '', role: '', color: colors[0] });
    } catch (error) {
      console.error("Error agregando miembro:", error);
    }
  };

  const handleDeleteMember = async (id) => {
    try {
      await deleteDoc(doc(db, 'team', id));
    } catch (error) {
      console.error("Error eliminando miembro:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-slate-800">Equipo de Ingeniería</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* List Members */}
          <div className="space-y-3">
            {team.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm" style={{ backgroundColor: member.color }}>
                    {member.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 leading-tight">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteMember(member.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <hr className="border-slate-100" />

          {/* Add New Member */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
              <User size={14} /> Agregar Miembro
            </h3>
            <input 
              type="text" 
              placeholder="Nombre completo" 
              value={newMember.name}
              onChange={(e) => setNewMember({...newMember, name: e.target.value})}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input 
              type="text" 
              placeholder="Rol (Ej: Ingeniero Eléctrico)" 
              value={newMember.role}
              onChange={(e) => setNewMember({...newMember, role: e.target.value})}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
            />
            
            <div>
              <p className="text-xs text-slate-500 mb-2">Color de avatar:</p>
              <div className="flex gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewMember({...newMember, color})}
                    className={`w-8 h-8 rounded-full border-2 ${newMember.color === color ? 'border-slate-800' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button 
              onClick={handleAddMember}
              className="w-full py-2.5 mt-2 bg-cyan-200 text-cyan-800 font-semibold rounded-lg hover:bg-cyan-300 transition-colors"
            >
              Agregar miembro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}