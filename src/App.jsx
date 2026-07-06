import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, RefreshCw, Users, Plus, Mail, Settings, 
  Clock, Zap, CheckCircle, X, Paperclip, GripVertical, User,
  LayoutDashboard, List, AlertTriangle, CalendarClock, AlertOctagon, RotateCcw, Search,
  Download, Filter, AlignLeft, ArrowUp, ArrowDown
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
  
  // Views and Archive state
  const [view, setView] = useState('board'); // 'board' | 'list'
  const [projectToArchive, setProjectToArchive] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  
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
      
      // ORDENAMIENTO ALFANUMÉRICO CORREGIDO (Ordena de mayor a menor)
      setProjects(projData.sort((a, b) => {
        const aNum = String(a.number || '');
        const bNum = String(b.number || '');
        return bNum.localeCompare(aNum, undefined, { numeric: true, sensitivity: 'base' });
      }));
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
  const handleSaveProject = async (projectData) => {
    if (!user) return;
    const isNew = !projectData.id;
    const docId = isNew ? crypto.randomUUID() : projectData.id;
    
    const finalData = {
      ...projectData,
      id: docId,
      updatedAt: serverTimestamp(),
      ...(isNew && { createdAt: serverTimestamp(), archived: false })
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
      const updateData = { status: newStatus, updatedAt: serverTimestamp() };
      
      // Guarda la fecha exacta cuando se pasa a terminado
      if (newStatus === 'terminado') {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(projRef, updateData);

      if (newStatus === 'terminado') {
        const proj = projects.find(p => p.id === projectId);
        if (proj && !proj.archived) {
          setProjectToArchive(projectId);
        }
      }
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!user) return;
    setProjectToDelete(projectId);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete));
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  };

  const handleArchiveProject = async (archive) => {
    if (archive && projectToArchive) {
      await updateDoc(doc(db, 'projects', projectToArchive), { archived: true });
    }
    setProjectToArchive(null);
  };

  const handleRestoreProject = async (projectId) => {
    if (!user) return;
    try {
      const projRef = doc(db, 'projects', projectId);
      // Lo restauramos y lo mandamos directamente a "desarrollo"
      await updateDoc(projRef, { 
        archived: false, 
        status: 'desarrollo',
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      console.error("Error restaurando proyecto:", error);
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

  // Contadores (excluyendo archivados solo para las columnas del Kanban, no para el total de terminados)
  const activeProjects = projects.filter(p => !p.archived);
  const counts = {
    inicio: activeProjects.filter(p => p.status === 'inicio').length,
    desarrollo: activeProjects.filter(p => p.status === 'desarrollo').length,
    terminado: projects.filter(p => p.status === 'terminado').length, // Ahora cuenta TODOS los terminados (incluso los que no están en el Kanban)
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
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setView('board')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'board' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutDashboard size={16} /> Tablero
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'list' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={16} /> Listado
            </button>
          </div>

          <div className="flex gap-2 text-sm font-medium hidden md:flex">
            <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full flex gap-2 items-center">
              <span className="font-bold">{activeProjects.length}</span> activos
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
        {view === 'board' ? (
          <>
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
                projects={activeProjects.filter(p => p.status === 'inicio')}
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
                projects={activeProjects.filter(p => p.status === 'desarrollo')}
                onUpdateStatus={handleUpdateProjectStatus}
                onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
                team={team}
              />
              <KanbanColumn 
                title="Terminado" 
                icon={<CheckCircle size={18} />} 
                color="bg-green-500" 
                status="terminado" 
                count={activeProjects.filter(p => p.status === 'terminado').length} // Aquí solo muestra los visibles en el tablero
                projects={activeProjects.filter(p => p.status === 'terminado')}
                onUpdateStatus={handleUpdateProjectStatus}
                onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
                team={team}
              />
            </div>
          </>
        ) : (
          <ProjectListView 
            projects={projects} 
            team={team} 
            onEdit={(p) => { setEditingProject(p); setIsNewProjectModalOpen(true); }}
            onRestore={handleRestoreProject}
          />
        )}
      </main>

      {/* MODALS Y ALERTAS */}
      {projectToArchive && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
            <div className="mx-auto w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={30} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¡Proyecto Terminado!</h3>
            <p className="text-sm text-slate-600 mb-6">¿Deseas retirar este proyecto del tablero principal? Seguirá estando disponible en el Listado general.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleArchiveProject(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                No, mantener en tablero
              </button>
              <button onClick={() => handleArchiveProject(true)} className="px-5 py-2.5 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 shadow-md shadow-green-500/20 transition-colors">
                Sí, retirar del tablero
              </button>
            </div>
          </div>
        </div>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
            <div className="mx-auto w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={30} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Eliminar Proyecto</h3>
            <p className="text-sm text-slate-600 mb-6">¿Estás seguro de que deseas eliminar permanentemente este proyecto? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setProjectToDelete(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 shadow-md shadow-red-500/20 transition-colors">
                Sí, eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

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
            Vacío
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

  // Lógica de advertencia de Fecha Promesa
  let isWarning = false;
  let daysLeft = null;
  if (project.promisedDate && project.status !== 'terminado' && !project.archived) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Para evitar zonas horarias, agregamos T00:00:00
    const promise = new Date(project.promisedDate + 'T00:00:00'); 
    const diffTime = promise - today;
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Alarma si es para hoy, ya pasó o faltan 2 días o menos
    if (daysLeft <= 2) {
      isWarning = true;
    }
  }

  const isUnassigned = assignedTeam.length === 0 && project.status !== 'terminado';

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onClick={() => onEdit(project)}
      className={`bg-white p-4 rounded-xl shadow-sm border ${isWarning ? 'border-red-400 shadow-red-100' : isUnassigned ? 'border-amber-400 shadow-amber-100' : 'border-slate-200'} cursor-pointer hover:shadow-md hover:border-cyan-300 transition-all group relative`}
    >
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-300 cursor-grab">
        <GripVertical size={16} />
      </div>
      
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase">#{project.number}</span>
        {project.priority && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(project.priority)} uppercase tracking-wider`}>
            {project.priority}
          </span>
        )}
        {project.archived && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-50 text-green-600 border-green-200 uppercase tracking-wider">
            Terminado
          </span>
        )}
        
        {/* Etiqueta de Alerta */}
        {isWarning && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse">
            <AlertOctagon size={12} />
            {daysLeft < 0 ? 'Vencido' : daysLeft === 0 ? 'Hoy' : `Faltan ${daysLeft}d`}
          </div>
        )}

        {/* Etiqueta Sin Asignar */}
        {isUnassigned && !isWarning && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
            Sin Asignar
          </div>
        )}
      </div>
      
      <h3 className="font-semibold text-slate-800 mb-1 leading-tight line-clamp-2">{project.title}</h3>
      
      <div className="flex flex-col gap-1 mb-3">
        {project.seller && (
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <User size={12} className="text-slate-400"/> {project.seller}
          </p>
        )}
        {project.promisedDate && (
          <p className={`text-xs font-medium flex items-center gap-1.5 ${isWarning ? 'text-red-500' : 'text-slate-500'}`}>
            <CalendarClock size={12} className={isWarning ? 'text-red-400' : 'text-slate-400'}/> 
            Promesa: {new Date(project.promisedDate + 'T00:00:00').toLocaleDateString()}
          </p>
        )}
        {project.notes && (
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1 border-t pt-1.5 border-slate-100 line-clamp-1">
            <AlignLeft size={12} className="text-slate-400"/> {project.notes}
          </p>
        )}
      </div>

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
        
        {/* Botón de Enlace a Carpeta */}
        {project.folderPath && (
          <a 
            href={project.folderPath} 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={(e) => e.stopPropagation()} 
            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
            title="Abrir carpeta en SharePoint/Teams"
          >
            <FolderOpen size={12} /> Abrir
          </a>
        )}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onSave, onDelete, team, initialFile, editingProject }) {
  const [sourceType, setSourceType] = useState('Manual');
  const [formData, setFormData] = useState({
    number: '',
    title: '',
    seller: '',
    sender: '',
    priority: 'Media',
    promisedDate: '',
    folderPath: '',
    notes: '',
    assignees: [],
    status: 'inicio'
  });

  useEffect(() => {
    if (editingProject) {
      setSourceType(editingProject.source || 'Manual');
      setFormData({
        ...editingProject,
        assignees: editingProject.assignees || []
      });
    } else if (initialFile) {
      const name = initialFile.name;
      const isMail = name.endsWith('.msg') || name.endsWith('.eml');
      setSourceType(isMail ? 'Correo' : 'Manual');
      setFormData(prev => ({ ...prev, title: name }));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.number.trim()) {
      alert("El número de proyecto es obligatorio");
      return;
    }
    if (!formData.title.trim()) {
      alert("El título / descripción es obligatorio");
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
                {['Manual', 'Correo'].map(type => (
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
                  <input type="text" name="sender" value={formData.sender || ''} onChange={handleChange} placeholder="nombre@empresa.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                </div>
              </div>
            )}

            {/* Project Number & Seller */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Número de Proyecto *</label>
                <input type="text" name="number" value={formData.number || ''} onChange={handleChange} required placeholder="Ej: 26-253" className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vendedor / Solicitante</label>
                <input type="text" name="seller" value={formData.seller || ''} onChange={handleChange} placeholder="Nombre del vendedor..." className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm" />
              </div>
            </div>

            {/* Main Info */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Título / Descripción del Proyecto *</label>
              <input type="text" name="title" value={formData.title || ''} onChange={handleChange} required placeholder="Ej: RV_ Carro bomba Albin + VLT" className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm" />
            </div>

            {/* Promise Date & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CalendarClock size={14} /> Fecha Promesa
                </label>
                <input type="date" name="promisedDate" value={formData.promisedDate || ''} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prioridad</label>
                <div className="flex gap-2">
                  {['Alta', 'Media', 'Baja'].map(prio => (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: prio }))}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
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
            </div>

            {/* Folder Path (Modificado para Enlaces de Teams) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FolderOpen size={14} /> Enlace de Carpeta (SharePoint / Teams)
              </label>
              <input type="text" name="folderPath" value={formData.folderPath || ''} onChange={handleChange} placeholder="Ej: https://tuempresa.sharepoint.com/..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-blue-600 font-medium focus:ring-2 focus:ring-cyan-500 outline-none bg-slate-50" />
            </div>

            {/* Notas / Último Avance */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlignLeft size={14} /> Notas de seguimiento / Último Avance
              </label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows="2" placeholder="Ej: A la espera de planos del cliente..." className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm resize-none"></textarea>
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

// --- VISTA DE LISTA GENERAL AMPLIADA CON BUSCADOR, ORDENAMIENTO Y EXPORTAR ---
function ProjectListView({ projects, team, onEdit, onRestore }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sellerFilter, setSellerFilter] = useState('Todos');
  const [sortConfig, setSortConfig] = useState({ key: 'number', direction: 'desc' });

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status, archived) => {
    if (archived) return <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold uppercase shadow-sm">Terminado</span>;
    switch(status) {
      case 'inicio': return <span className="px-3 py-1 bg-slate-400 text-white rounded-full text-xs font-bold uppercase shadow-sm">Inicio</span>;
      case 'desarrollo': return <span className="px-3 py-1 bg-yellow-400 text-white rounded-full text-xs font-bold uppercase shadow-sm">Desarrollo</span>;
      case 'terminado': return <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold uppercase shadow-sm">Terminado</span>;
      default: return null;
    }
  };

  // Solicitar un nuevo orden (al hacer clic en la cabecera)
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Obtener lista única de vendedores para el filtro
  const uniqueSellers = [...new Set(projects.map(p => p.seller).filter(Boolean))].sort();

  // Filtrado de proyectos según la búsqueda y filtros
  const filteredProjects = projects.filter(p => {
    // Filtro por Estado
    if (statusFilter !== 'Todos') {
      if (statusFilter === 'Terminado' && p.status !== 'terminado') return false;
      if (statusFilter === 'Desarrollo' && p.status !== 'desarrollo') return false;
      if (statusFilter === 'Inicio' && p.status !== 'inicio') return false;
    }

    // Filtro por Vendedor
    if (sellerFilter !== 'Todos' && p.seller !== sellerFilter) return false;

    // Búsqueda de texto
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    
    // Obtener nombres de los asignados
    const assigneesNames = team
      .filter(t => (p.assignees || []).includes(t.id))
      .map(t => t.name.toLowerCase())
      .join(' ');

    return (p.number || '').toLowerCase().includes(s) ||
           (p.title || '').toLowerCase().includes(s) ||
           (p.seller || '').toLowerCase().includes(s) ||
           assigneesNames.includes(s);
  });

  // Aplicar el ordenamiento sobre los proyectos ya filtrados
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortConfig.key === 'number') {
      const aNum = a.number || '';
      const bNum = b.number || '';
      // El localeCompare numérico soluciona el orden de "26-50" frente a "26-253"
      const result = aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? result : -result;
    } 
    else if (sortConfig.key === 'createdAt') {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (aTime < bTime) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aTime > bTime) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
    return 0;
  });

  const exportToCSV = () => {
    // Encabezados EXACTOS a los que pide la jefa de ventas + Fecha de Creación
    const headers = [
      'CODIGO PROYECTO', 
      'FECHA DE CREACION', // <-- NUEVA COLUMNA AGREGADA
      'AA', 
      'SUCURSAL', 
      ' ', // Columna D vacía de su Excel
      'DESCRIPCION', // Columna E de su Excel
      'FECHA DE PROMESA', 
      'RESPONSABLE', 
      'COMENTARIOS DE INGENIERIA', 
      'COMENTARIOS DEL VENDEDOR', 
      'FECHA DE CUMPLIMIENTO'
    ];
    
    // Usamos PUNTO Y COMA para que el Excel en español lo separe en columnas automáticamente
    const separator = ';';
    const csvRows = [headers.join(separator)];
    
    sortedProjects.forEach(p => {
      const codigo = p.number || '';
      
      // Calculamos la fecha de creación para el reporte
      const fechaCreacion = p.createdAt ? formatDate(p.createdAt) : '';

      const vendedor = `"${(p.seller || '').replace(/"/g, '""')}"`;
      const sucursal = ''; // Dejado en blanco a propósito
      const colD = ''; // Dejado en blanco a propósito
      const descripcion = `"${(p.title || '').replace(/"/g, '""')}"`;
      const promesa = p.promisedDate ? new Date(p.promisedDate + 'T00:00:00').toLocaleDateString('es-AR') : '';
      
      // Obtener iniciales de los responsables
      const responsables = team
        .filter(t => (p.assignees || []).includes(t.id))
        .map(t => t.initials)
        .join('-'); // Ej: LM-AR
      
      const comentariosIng = `"${(p.notes || '').replace(/"/g, '""')}"`;
      const comentariosVend = ''; // Dejado en blanco a propósito
      const fechaCumplimiento = p.completedAt ? formatDate(p.completedAt) : '';
      
      csvRows.push([
        codigo, 
        fechaCreacion, // <-- INCLUIDO EN LA EXPORTACIÓN
        vendedor, 
        sucursal, 
        colD, 
        descripcion, 
        promesa, 
        responsables, 
        comentariosIng, 
        comentariosVend, 
        fechaCumplimiento
      ].join(separator));
    });
    
    const csvContent = csvRows.join('\n');
    
    // El "BOM" (Byte Order Mark) le dice a Excel que el archivo es UTF-8, arreglando los acentos
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Ingenieria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      
      {/* Buscador y Filtros */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2 whitespace-nowrap">
          <List size={18} /> Todos los Proyectos
        </h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm outline-none text-slate-600 font-medium cursor-pointer">
              <option value="Todos">Todos los Estados</option>
              <option value="Inicio">Inicio</option>
              <option value="Desarrollo">En Desarrollo</option>
              <option value="Terminado">Terminados</option>
            </select>
          </div>

          {uniqueSellers.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm">
              <User size={16} className="text-slate-400" />
              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="bg-transparent text-sm outline-none text-slate-600 font-medium max-w-[150px] cursor-pointer">
                <option value="Todos">Todos los Vendedores</option>
                {uniqueSellers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-sm"
            />
          </div>

          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ml-auto"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                onClick={() => requestSort('number')}
                title="Hacer clic para ordenar por Número"
              >
                <div className="flex items-center gap-1">
                  Nº Proyecto
                  {sortConfig.key === 'number' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-cyan-600" /> : <ArrowDown size={14} className="text-cyan-600" />
                  ) : (
                    <ArrowDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </th>
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                onClick={() => requestSort('createdAt')}
                title="Hacer clic para ordenar por Fecha"
              >
                <div className="flex items-center gap-1">
                  Fecha Creación
                  {sortConfig.key === 'createdAt' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-cyan-600" /> : <ArrowDown size={14} className="text-cyan-600" />
                  ) : (
                    <ArrowDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </th>
              <th className="p-4 font-bold">Descripción</th>
              <th className="p-4 font-bold">Vendedor</th>
              <th className="p-4 font-bold">Responsable(s)</th>
              <th className="p-4 font-bold">Estado</th>
              <th className="p-4 font-bold">Fecha Promesa</th>
              <th className="p-4 font-bold">Fecha Término</th>
              <th className="p-4 font-bold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sortedProjects.length === 0 ? (
              <tr>
                <td colSpan="9" className="p-8 text-center text-slate-400 font-medium">
                  No se encontraron proyectos para tu búsqueda o filtro.
                </td>
              </tr>
            ) : (
              sortedProjects.map(project => {
                const assignedTeam = team.filter(t => (project.assignees || []).includes(t.id));
                return (
                  <tr 
                    key={project.id} 
                    onClick={() => onEdit(project)}
                    className="border-b border-slate-100 hover:bg-cyan-50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-bold text-cyan-700 whitespace-nowrap">#{project.number}</td>
                    <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(project.createdAt)}</td>
                    <td className="p-4 text-slate-800 font-medium max-w-xs truncate" title={project.title}>{project.title}</td>
                    <td className="p-4 text-slate-600 font-medium">{project.seller || '-'}</td>
                    
                    <td className="p-4">
                      <div className="flex -space-x-1">
                        {assignedTeam.length > 0 ? assignedTeam.map((member, i) => (
                          <div 
                            key={member.id} title={member.name}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white shadow-sm"
                            style={{ backgroundColor: member.color, zIndex: 10 - i }}
                          >
                            {member.initials}
                          </div>
                        )) : (
                          <span className="text-xs text-slate-400">Sin asignar</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">{getStatusBadge(project.status, project.archived)}</td>
                    
                    <td className="p-4 text-slate-500 whitespace-nowrap text-xs">
                      {project.promisedDate ? new Date(project.promisedDate + 'T00:00:00').toLocaleDateString() : '-'}
                    </td>

                    <td className="p-4 text-slate-500 whitespace-nowrap text-xs font-medium">
                      {(project.status === 'terminado' || project.archived) && project.completedAt ? formatDate(project.completedAt) : '-'}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botón rápido para abrir carpeta en el Listado */}
                        {project.folderPath && (
                          <a 
                            href={project.folderPath} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center p-1.5 text-blue-600 bg-blue-50 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
                            title="Abrir carpeta de Teams/SharePoint"
                          >
                            <FolderOpen size={14} />
                          </a>
                        )}

                        {project.archived ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onRestore(project.id); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 bg-cyan-100 px-3 py-1.5 rounded-lg hover:bg-cyan-200 transition-colors whitespace-nowrap"
                          >
                            <RotateCcw size={14} /> Restaurar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 whitespace-nowrap">Activo en Tablero</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}