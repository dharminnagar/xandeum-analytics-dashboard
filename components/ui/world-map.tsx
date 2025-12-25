"use client";

import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import CameraControls from "camera-controls";

CameraControls.install({ THREE });

type GeoJSONFeature = {
  type: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
};

type GeoJSONData = {
  type: string;
  features: GeoJSONFeature[];
};

type MapLocation = {
  lat: number;
  lng: number;
  ip?: string;
  city?: string | null;
  country?: string | null;
  nodeCount?: number;
  label?: string;
  pubkeys?: string[];
};

type WorldMapProps = {
  locations: MapLocation[];
  height?: string;
  onLocationClick?: (location: MapLocation) => void;
  selectedLocation?: MapLocation | null;
};

type TooltipState = {
  label: string;
  x: number;
  y: number;
};

function CameraController({
  selectedLocation,
}: {
  selectedLocation?: MapLocation | null;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<CameraControls | null>(null);

  useEffect(() => {
    const controls = new CameraControls(camera, gl.domElement);
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.dampingFactor = 0.05;
    controls.draggingDampingFactor = 0.25;
    controls.azimuthRotateSpeed = 0.5;
    controls.polarRotateSpeed = 0.5;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    controlsRef.current?.update(delta);
  });

  useEffect(() => {
    if (selectedLocation && controlsRef.current) {
      const phi = (90 - selectedLocation.lat) * (Math.PI / 180);
      const theta = (selectedLocation.lng + 180) * (Math.PI / 180);

      const distance = 4;
      const x = -distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.cos(phi);
      const z = distance * Math.sin(phi) * Math.sin(theta);

      controlsRef.current.setLookAt(x, y, z, 0, 0, 0, true);
    }
  }, [selectedLocation]);

  return null;
}

function GlobeScene({
  locations,
  setHoveredNode,
  onLocationClick,
  selectedLocation,
}: {
  locations: MapLocation[];
  setHoveredNode: React.Dispatch<React.SetStateAction<TooltipState | null>>;
  onLocationClick?: (location: MapLocation) => void;
  selectedLocation?: MapLocation | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    )
      .then((response) => response.json())
      .then((data: GeoJSONData) => setGeoData(data))
      .catch((error) => console.error("Error loading GeoJSON:", error));
  }, []);

  const convertToSphereCoordinates = (lon: number, lat: number, radius = 2) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return {
      x: -radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta),
    };
  };

  const createCountryLines = () => {
    if (!geoData) return null;

    const lines: React.ReactElement[] = [];

    geoData.features.forEach((feature, featureIndex) => {
      const { geometry } = feature;
      let coordinateArrays: number[][][] = [];

      if (geometry.type === "Polygon") {
        coordinateArrays = geometry.coordinates as number[][][];
      } else if (geometry.type === "MultiPolygon") {
        const multiPolygon = geometry.coordinates as number[][][][];
        coordinateArrays = multiPolygon.flat();
      }

      coordinateArrays.forEach((ring, ringIndex) => {
        const points: THREE.Vector3[] = [];

        ring.forEach(([lon, lat]) => {
          const sphereCoords = convertToSphereCoordinates(lon, lat);
          points.push(
            new THREE.Vector3(sphereCoords.x, sphereCoords.y, sphereCoords.z)
          );
        });

        if (points.length > 1) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          lines.push(
            <primitive
              key={`${featureIndex}-${ringIndex}`}
              object={
                new THREE.Line(
                  lineGeometry,
                  new THREE.LineBasicMaterial({
                    color: isDark ? "#ffffff" : "#000000",
                    transparent: true,
                    opacity: isDark ? 0.5 : 0.25,
                  })
                )
              }
            />
          );
        }
      });
    });

    return lines;
  };

  const createNodeMarkers = () => {
    if (!locations || locations.length === 0) return null;

    return locations.map((location, index) => {
      const sphereCoords = convertToSphereCoordinates(
        location.lng,
        location.lat,
        2.03
      );

      const isSelected =
        selectedLocation &&
        selectedLocation.lat === location.lat &&
        selectedLocation.lng === location.lng;

      return (
        <mesh
          key={`marker-${index}`}
          position={[sphereCoords.x, sphereCoords.y, sphereCoords.z]}
          onClick={(e) => {
            e.stopPropagation();
            onLocationClick?.(location);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";

            setHoveredNode({
              label: JSON.stringify({
                ip: location.ip,
                location:
                  [location.city, location.country]
                    .filter(Boolean)
                    .join(", ") || "Unknown",
                nodeCount: location.nodeCount || 1,
              }),
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            setHoveredNode((prev) =>
              prev
                ? {
                    ...prev,
                    x: e.clientX,
                    y: e.clientY,
                  }
                : null
            );
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "default";
            setHoveredNode(null);
          }}
        >
          <sphereGeometry args={isSelected ? [0.02, 8, 8] : [0.012, 8, 8]} />
          <meshBasicMaterial color={isSelected ? "#f97316" : "#22c55e"} />
        </mesh>
      );
    });
  };

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 32]} />
        <meshBasicMaterial
          color={isDark ? "#000000" : "#f5f5f5"}
          transparent
          opacity={isDark ? 0.9 : 0.95}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.005, 64, 32]} />
        <meshBasicMaterial
          color={isDark ? "#ffffff" : "#666666"}
          wireframe
          transparent
          opacity={isDark ? 0.05 : 0.1}
        />
      </mesh>

      {createCountryLines()}
      {createNodeMarkers()}
    </group>
  );
}

export function WorldMap({
  locations,
  height = "500px",
  onLocationClick,
  selectedLocation,
}: WorldMapProps) {
  const [hoveredNode, setHoveredNode] = useState<TooltipState | null>(null);

  return (
    <div
      style={{
        width: "100%",
        height,
        background: "transparent",
        position: "relative",
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <CameraController selectedLocation={selectedLocation} />
        <GlobeScene
          locations={locations}
          setHoveredNode={setHoveredNode}
          onLocationClick={onLocationClick}
          selectedLocation={selectedLocation}
        />
      </Canvas>

      {hoveredNode &&
        (() => {
          try {
            const data = JSON.parse(hoveredNode.label);
            return (
              <div
                style={{
                  position: "fixed",
                  left: hoveredNode.x + 15,
                  top: hoveredNode.y + 15,
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
                className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-sm shadow-lg"
              >
                <div className="space-y-1">
                  <div className="font-semibold">{data.ip}</div>
                  <div className="text-muted-foreground">{data.location}</div>
                  <div>
                    {data.nodeCount} {data.nodeCount === 1 ? "node" : "nodes"}
                  </div>
                </div>
              </div>
            );
          } catch {
            return (
              <div
                style={{
                  position: "fixed",
                  left: hoveredNode.x + 15,
                  top: hoveredNode.y + 15,
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
                className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-sm shadow-lg"
              >
                {hoveredNode.label}
              </div>
            );
          }
        })()}
    </div>
  );
}
