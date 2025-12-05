import React from 'react';

import AnimatedBackground from '@/ui/components/AnimatedBackground';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <AnimatedBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%'
        }}
      >
        {children}
      </div>
    </>
  );
};

export default AppLayout;
