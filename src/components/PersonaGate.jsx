import { useState } from 'react';
import { track } from '@vercel/analytics';
import { PERSONAS } from '../personaConfig';

// First-time visitor modal for persona selection
const PersonaGate = ({ onSelect }) => {
  const [selectedPersona, setSelectedPersona] = useState(null);

  const handleContinue = () => {
    if (selectedPersona) {
      onSelect(selectedPersona);
      track('persona_selected_first_time', { persona: selectedPersona });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center border-b border-gray-100">
          <img src="/android-chrome-192x192.png" alt="OpenOnco" className="h-14 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Welcome to OpenOnco</h2>
          <p className="text-gray-500 mt-2">How would you like to explore? We'll tailor the information for you.</p>
        </div>
        
        {/* Persona Options */}
        <div className="p-4 space-y-2">
          {Object.entries(PERSONAS).map(([key, p]) => {
            const isSelected = selectedPersona === key;
            
            return (
              <button
                key={key}
                onClick={() => setSelectedPersona(key)}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all text-left
                  ${isSelected ? 'shadow-md' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                style={isSelected ? { 
                  borderColor: p.color,
                  backgroundColor: p.bgColor
                } : {}}
              >
                {/* Radio circle */}
                <div 
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${isSelected ? '' : 'border-gray-300'}`}
                  style={isSelected ? { borderColor: p.color } : {}}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  )}
                </div>
                
                {/* Icon */}
                {p.iconImage ? (
                  <img src={p.iconImage} alt="" className="w-7 h-7 object-contain" />
                ) : (
                  <span className="text-2xl">{p.icon}</span>
                )}
                
                {/* Text */}
                <div className="flex-1">
                  <h3 className={`font-medium ${isSelected ? '' : 'text-gray-900'}`} style={isSelected ? { color: p.color } : {}}>
                    {p.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Continue Button */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleContinue}
            disabled={!selectedPersona}
            className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all
              ${selectedPersona 
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg shadow-teal-500/25' 
                : 'bg-gray-300 cursor-not-allowed'}`}
          >
            Continue to OpenOnco
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonaGate;
