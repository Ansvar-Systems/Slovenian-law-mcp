export type DocumentType = 'statute' | 'regulation' | 'constitutional' | 'parliamentary' | 'case_law';

export type DocumentStatus = 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';

export type CourtType =
  | 'USRS'   // Ustavno sodišče (Constitutional Court)
  | 'VSRS'   // Vrhovno sodišče (Supreme Court)
  | 'VSL'    // Višje sodišče v Ljubljani
  | 'VSM'    // Višje sodišče v Mariboru
  | 'VSK'    // Višje sodišče v Kopru
  | 'VSC'    // Višje sodišče v Celju
  | 'UPRS'   // Upravno sodišče (Administrative Court)
  | 'VDSS'   // Višje delovno in socialno sodišče
  | 'IESP';  // Informacijsko-evidenčni sistem pravosodja

export interface LegalDocument {
  id: string;
  type: DocumentType;
  title: string;
  title_en?: string;
  short_name?: string;
  status: DocumentStatus;
  issued_date?: string;
  in_force_date?: string;
  url?: string;
  description?: string;
}
