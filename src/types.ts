export interface District {
    il: string;
    ilce: string;
    subeVar: boolean;
}

export interface DistrictMeta {
    il: string;
    ilce: string;
    townId?: string | number;
    cityId?: string | number;
    [key: string]: any;
}

export interface ChangesReport {
    carrier: string;
    checkedAt: string;
    subeEklenenIlceler: Array<{ il: string; ilce: string }>;
    subeKaldirilanIlceler: Array<{ il: string; ilce: string }>;
}

export interface CarrierProvider {
    readonly id: string;
    readonly displayName: string;
    
    // Initialize provider resources (browser, sessions, etc.)
    init(): Promise<void>;
    
    // Load or download districts
    getDistricts(fresh?: boolean): Promise<DistrictMeta[]>;
    
    // Check branch existence for a single district
    checkBranch(district: DistrictMeta): Promise<boolean>;
    
    // Cleanup resources
    close(): Promise<void>;
}
