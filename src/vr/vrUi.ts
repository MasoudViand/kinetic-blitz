import * as THREE from 'three';

export interface VrUiButtonEntry {
  id: string;
  mesh: THREE.Object3D;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}

class VrUiRegistry {
  private buttons: Map<string, VrUiButtonEntry> = new Map();
  public hudPlane: THREE.Mesh | null = null;

  public registerButton(entry: VrUiButtonEntry) {
    this.buttons.set(entry.id, entry);
  }

  public unregisterButton(id: string) {
    this.buttons.delete(id);
  }

  public getButtons(): VrUiButtonEntry[] {
    return Array.from(this.buttons.values());
  }

  public setHudPlane(mesh: THREE.Mesh | null) {
    this.hudPlane = mesh;
  }
}

export const vrUiRegistry = new VrUiRegistry();
