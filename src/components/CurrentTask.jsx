import { AnimatePresence, motion } from 'framer-motion';
import { Activity, CheckCircle2, Terminal, X } from 'lucide-react';
import { useRef, useState } from 'react';

const CurrentTask = () => {
    // State for tasks and input
    const [tasks, setTasks] = useState([
        { id: 1, text: "Refactoring Overlay", status: "active" }
    ]);
    const [newItem, setNewItem] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    const handleAddTask = (e) => {
        if (e.key === 'Enter' && newItem.trim()) {
            setTasks([...tasks, { id: Date.now(), text: newItem, status: 'pending' }]);
            setNewItem("");
        }
    };

    const removeTask = (id) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const toggleStatus = (id) => {
        setTasks(tasks.map(t =>
            t.id === id ? { ...t, status: t.status === 'active' ? 'pending' : 'active' } : t
        ));
    };

    return (
        <motion.div
            className="w-full h-full bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-2xl relative group"
        >
            {/* Header / Input Area */}
            <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-white/5">
                <div className="p-1.5 bg-blue-500/20 rounded-md">
                    <Terminal className="text-blue-400" size={16} />
                </div>

                <div className="flex-1">
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={handleAddTask}
                        placeholder="Type objective & hit Enter..."
                        className="w-full bg-transparent border-none outline-none text-white text-sm placeholder:text-white/20 font-medium"
                    />
                </div>

                <div className="flex items-center gap-2 text-[10px] text-blue-300/80 font-mono uppercase tracking-wider opacity-60">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                    </span>
                    LIVE
                </div>
            </div>

            {/* Task List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <AnimatePresence mode='popLayout'>
                    {tasks.map((task) => (
                        <motion.div
                            key={task.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            layout
                            className={`flex items-center gap-3 p-2 rounded-md border group/item transition-all ${task.status === 'active'
                                    ? 'bg-blue-500/10 border-blue-500/30'
                                    : 'bg-white/5 border-white/5 opacity-60 hover:opacity-100'
                                }`}
                        >
                            <button onClick={() => toggleStatus(task.id)} className="shrink-0 focus:outline-none">
                                {task.status === 'active' ? (
                                    <Activity className="text-blue-400 animate-pulse" size={14} />
                                ) : (
                                    <CheckCircle2 className="text-gray-500 hover:text-green-400 transition-colors" size={14} />
                                )}
                            </button>

                            <span className={`text-sm font-medium truncate flex-1 ${task.status === 'active' ? 'text-white' : 'text-gray-400 line-through decoration-white/20'}`}>
                                {task.text}
                            </span>

                            <button
                                onClick={() => removeTask(task.id)}
                                className="opacity-0 group-hover/item:opacity-100 text-white/20 hover:text-red-400 transition-all focus:outline-none"
                            >
                                <X size={14} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {tasks.length === 0 && (
                    <div className="text-center py-4 text-white/10 text-xs italic">
                        No active objectives. Type above to add one.
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default CurrentTask;
