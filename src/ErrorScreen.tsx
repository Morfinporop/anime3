import { useEffect, useState } from 'react';

type ShapeType = 'cube' | 'circle';

interface Shape {
  id: number;
  type: ShapeType;
  x: number;
  y: number;
  size: number;
  rotation: number;
  delay: number;
}

export default function ErrorScreen() {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    const newShapes: Shape[] = [];
    for (let i = 0; i < 20; i++) {
      newShapes.push({
        id: i,
        type: (Math.random() > 0.5 ? 'cube' : 'circle') as ShapeType,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 20 + Math.random() * 60,
        rotation: Math.random() * 360,
        delay: Math.random() * 5,
      });
    }
    setShapes(newShapes);
  }, []);

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center overflow-hidden">
      {/* Animated shapes background */}
      <div className="absolute inset-0 overflow-hidden">
        {shapes.map((shape) => (
          <div
            key={shape.id}
            className="absolute opacity-[0.03]"
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: shape.size,
              height: shape.size,
              transform: `rotate(${shape.rotation}deg)`,
              animation: `float ${8 + shape.delay}s ease-in-out infinite`,
              animationDelay: `${shape.delay}s`,
            }}
          >
            {shape.type === 'cube' ? (
              <div 
                className="w-full h-full bg-black"
                style={{
                  transform: 'perspective(100px) rotateX(15deg) rotateY(15deg)',
                  boxShadow: '5px 5px 0 rgba(0,0,0,0.2)',
                }}
              />
            ) : (
              <div className="w-full h-full bg-black rounded-full" />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        <div className="mb-6">
          <svg className="w-20 h-20 mx-auto text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-800 mb-3">
          Приносим свои извинения, сайт немного устал
        </h1>
        <p className="text-zinc-500 mb-6 max-w-md mx-auto">
          Мы уже работаем над решением проблемы. Пожалуйста, попробуйте обновить страницу через несколько минут.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Обновить страницу
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
