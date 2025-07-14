'use client';

import React, { useRef, useEffect } from 'react';
import { Renderer, Camera, Transform, Program, Geometry, Vec3, Color, Mesh } from 'ogl';

interface ParticlesProps extends React.HTMLAttributes<HTMLDivElement> {
  particleCount?: number;
  particleColors?: string[];
  particleSpread?: number;
  speed?: number;
  particleBaseSize?: number;
  moveParticlesOnHover?: boolean;
  alphaParticles?: boolean;
  disableRotation?: boolean;
}

const vertex = `
  attribute vec3 position;
  attribute vec3 offset;
  attribute vec3 color;
  attribute float scale;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSpread;

  varying vec3 vColor;

  void main() {
    vColor = color;

    // basic rotation
    float t = uTime * uSpeed + offset.y * 10.0;
    float wave = cos(t) * 0.5 + 0.5;
    
    vec3 pos = position;

    pos.y += sin(offset.x * uSpread + t) * 0.2;
    pos.x += cos(offset.z * uSpread + t) * 0.2;
    pos.z += sin(offset.y * uSpread + t) * 0.2;
    
    pos *= scale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = scale * 1.5;
  }
`;

const fragment = `
  precision highp float;
  varying vec3 vColor;
  uniform float uAlpha;

  void main() {
    float dist = length(gl_PointCoord.xy - vec2(0.5));
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
    gl_FragColor.rgb = vColor;
    gl_FragColor.a = uAlpha > 0.0 ? alpha * uAlpha : alpha;
  }
`;

export default function Particles({
  particleCount = 200,
  particleColors = ['#ffffff', '#ffffff'],
  particleSpread = 10,
  speed = 0.1,
  particleBaseSize = 1,
  moveParticlesOnHover = true,
  alphaParticles = false,
  disableRotation = false,
  className,
  ...props
}: ParticlesProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new Renderer({
      dpr: 2,
      alpha: true,
      premultipliedAlpha: true,
    });
    const gl = renderer.gl;
    const element = canvasRef.current;
    element.appendChild(gl.canvas);

    const camera = new Camera(gl, { fov: 45, near: 0.1, far: 100 });
    camera.position.z = 15;

    const scene = new Transform();

    const onResize = () => {
      renderer.setSize(element.offsetWidth, element.offsetHeight);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    };

    window.addEventListener('resize', onResize, false);
    onResize();

    const particleProgram = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uSpread: { value: particleSpread },
        uAlpha: { value: alphaParticles ? 0.3 : 1.0 },
      },
      transparent: true,
      depthTest: false,
    });

    const numParticles = particleCount;
    const position = new Float32Array(numParticles * 3);
    const offset = new Float32Array(numParticles * 3);
    const color = new Float32Array(numParticles * 3);
    const scale = new Float32Array(numParticles);

    for (let i = 0; i < numParticles; i++) {
      const i3 = i * 3;
      position.set([0, 0, 0], i3); // All start at center

      offset.set(
        [
          (Math.random() - 0.5) * particleSpread,
          (Math.random() - 0.5) * particleSpread,
          (Math.random() - 0.5) * particleSpread,
        ],
        i3
      );

      const chosenColor = new Color(particleColors[Math.floor(Math.random() * particleColors.length)]);
      color.set([chosenColor.r, chosenColor.g, chosenColor.b], i3);
      scale[i] = Math.random() * particleBaseSize * 0.05 + 0.02;
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      offset: { size: 3, data: offset },
      color: { size: 3, data: color },
      scale: { size: 1, data: scale },
    });

    const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program: particleProgram });
    particles.setParent(scene);
    
    const handleMouseMove = (e: MouseEvent) => {
        if (!moveParticlesOnHover) return;
        pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    if (moveParticlesOnHover) {
        window.addEventListener('mousemove', handleMouseMove);
    }

    let rafId: number;
    const update = (t: number) => {
      rafId = requestAnimationFrame(update);
      particleProgram.uniforms.uTime.value = t * 0.001;
      
      if (!disableRotation) {
        particles.rotation.y += 0.001;
      }
      
      if (moveParticlesOnHover) {
        camera.position.x += (pointer.current.x * 2 - camera.position.x) * 0.05;
        camera.position.y += (pointer.current.y * 2 - camera.position.y) * 0.05;
        camera.lookAt(new Vec3(0,0,0));
      }

      renderer.render({ scene, camera });
    };

    rafId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', onResize);
      if (moveParticlesOnHover) {
          window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(rafId);
      element.removeChild(gl.canvas);
    };
  }, [particleCount, particleColors, particleSpread, speed, particleBaseSize, moveParticlesOnHover, alphaParticles, disableRotation]);

  return <div ref={canvasRef} className={className} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: -1 }} {...props} />;
}
