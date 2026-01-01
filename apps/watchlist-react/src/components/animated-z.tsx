export function AnimatedZ({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>Z logo</title>
      <defs>
        <linearGradient id="zGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.606 0.25 292.717)" />
          <stop offset="50%" stopColor="oklch(0.541 0.281 293.009)" />
          <stop offset="100%" stopColor="oklch(0.491 0.27 292.581)" />
        </linearGradient>
      </defs>
      <style>
        {`
          .rotating-z {
            animation: rotateY 3s ease-in-out infinite;
            transform-origin: center center;
            transform-box: fill-box;
          }
          @keyframes rotateY {
            0% {
              transform: perspective(300px) rotateY(0deg) scale(1);
              opacity: 1;
            }
            25% {
              transform: perspective(300px) rotateY(90deg) scale(0.95);
              opacity: 0.8;
            }
            50% {
              transform: perspective(300px) rotateY(180deg) scale(1);
              opacity: 1;
            }
            75% {
              transform: perspective(300px) rotateY(270deg) scale(0.95);
              opacity: 0.8;
            }
            100% {
              transform: perspective(300px) rotateY(360deg) scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
      <g transform="translate(50, 50)">
        <text
          className="rotating-z"
          x="0"
          y="0"
          fontFamily="Arial, sans-serif"
          fontSize="80"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
          fill="url(#zGradient)"
        >
          Z
        </text>
      </g>
    </svg>
  );
}
