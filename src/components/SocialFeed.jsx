import { motion } from 'framer-motion';
import { Github, Linkedin, MonitorPlay, Twitter } from 'lucide-react';

const SocialFeed = ({ github, twitter, linkedin }) => {
    // Compact list
    const socialLinks = [
        { icon: <Github size={18} />, label: github, color: "text-white" },
        { icon: <Twitter size={18} />, label: twitter, color: "text-blue-400" },
        { icon: <Linkedin size={18} />, label: linkedin, color: "text-blue-600" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col gap-2 shadow-lg"
        >
            <div className="flex items-center gap-2 mb-2">
                <MonitorPlay className="text-purple-400" size={16} />
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Socials</span>
            </div>

            <div className="space-y-3">
                {socialLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-3 group cursor-pointer">
                        <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${link.color}`}>
                            {link.icon}
                        </div>
                        <span className="text-sm text-gray-400 group-hover:text-white transition-colors font-medium">
                            {link.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Mini Ticker or Status */}
            <div className="mt-1 pt-2 border-t border-white/5">
                <div className="overflow-hidden relative h-6">
                    <motion.div
                        animate={{ x: ["100%", "-100%"] }}
                        transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                        className="whitespace-nowrap absolute text-xs text-green-400/80 font-mono"
                    >
                        /// SYSTEM STATUS: ONLINE /// STREAMING: ACTIVE ///
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default SocialFeed;
