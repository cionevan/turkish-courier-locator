import { CarrierProvider } from '../types';
import { ArasProvider } from './aras';
import { PttProvider } from './ptt';
import { YurticiProvider } from './yurtici';
import { MngProvider } from './mng';
import { SuratProvider } from './surat';

const providers: Record<string, () => CarrierProvider> = {
    'aras': () => new ArasProvider(),
    'aras-kargo': () => new ArasProvider(),
    'ptt': () => new PttProvider(),
    'ptt-kargo': () => new PttProvider(),
    'yurtici': () => new YurticiProvider(),
    'yurtici-kargo': () => new YurticiProvider(),
    'mng': () => new MngProvider(),
    'mng-kargo': () => new MngProvider(),
    'surat': () => new SuratProvider(),
    'surat-kargo': () => new SuratProvider(),
};

export function getProvider(carrierName: string): CarrierProvider {
    const key = carrierName.toLowerCase().trim();
    const factory = providers[key];
    if (!factory) {
        throw new Error(`Carrier '${carrierName}' not found. Available carriers: ${getAvailableCarrierNames().join(', ')}`);
    }
    return factory();
}

export function getAllProviders(): CarrierProvider[] {
    return [
        new ArasProvider(),
        new PttProvider(),
        new YurticiProvider(),
        new MngProvider(),
        new SuratProvider()
    ];
}

export function getAvailableCarrierNames(): string[] {
    return ['aras', 'ptt', 'yurtici', 'mng', 'surat'];
}
