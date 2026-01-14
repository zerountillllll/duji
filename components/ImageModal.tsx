import React from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-safe right-4 z-50 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 pt-safe mt-4"
      >
        <X size={24} />
      </button>
      
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <img 
          src={imageUrl} 
          alt="Full screen view" 
          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg scale-100 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
        />
      </div>
    </div>
  );
};