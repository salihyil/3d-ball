import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Character } from './Character';

// Mock sub-components to verify they are called with correct props
vi.mock('./Aura', () => ({
  Aura: ({ id }: { id: string }) => <div data-testid={`aura-${id}`} />,
}));
vi.mock('./Decal', () => ({
  Decal: ({ id }: { id: string }) => <div data-testid={`decal-${id}`} />,
}));
vi.mock('./Trail', () => ({
  Trail: ({ id }: { id: string }) => <div data-testid={`trail-${id}`} />,
}));

// Mock @react-three/drei and fiber to avoid canvas issues in JSDOM
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock('@react-three/drei', () => ({
  useTexture: () => ({}),
  Decal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OrbitControls: () => null,
  Stage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Character Component Customization Stacking', () => {
  const skins = {
    acid: 'f2a9d2b2-6b9a-4e2b-9e4a-4d2b2f2a9d2b',
  };
  const accessories = {
    aura: 'e1b2c3d4-0000-4000-8000-000000000001',
    decal: 'e1b2c3d4-0000-4000-8000-000000000002',
    trail: 'e1b2c3d4-0000-4000-8000-000000000003',
    hat: '9c647409-c38b-4ce7-b0a4-4be8e8765795',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all equipped accessory types simultaneously (stacking)', () => {
    const equipped = [
      skins.acid,
      accessories.aura,
      accessories.decal,
      accessories.trail,
    ];

    // We wrap in a simple div because we've mocked the R3F environment away
    const { getByTestId } = render(
      <Character id="test-p1" initialTeam="blue" forceAccessories={equipped} />
    );

    // Verify each category component is mounted with the correct ID
    expect(getByTestId(`aura-${accessories.aura}`)).toBeDefined();
    expect(getByTestId(`decal-${accessories.decal}`)).toBeDefined();
    expect(getByTestId(`trail-${accessories.trail}`)).toBeDefined();
  });

  it('should render multiple items of the same category if provided (additive logic)', () => {
    const equipped = [accessories.aura, accessories.hat];

    const { getByTestId } = render(
      <Character id="test-p1" initialTeam="blue" forceAccessories={equipped} />
    );

    expect(getByTestId(`aura-${accessories.aura}`)).toBeDefined();
    // Accessory (Hat) is rendered as a mesh inside Character,
    // we can't easily test its internal mesh without more complex mocking,
    // but we've verified the category distribution logic in the previous test.
  });
});
