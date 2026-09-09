/**
 * Cross-platform Turkish string normalization.
 * Avoids OS-specific locale discrepancies with 'i'/'İ' and 'ı'/'I'.
 */
export function normalizeTurkish(str: string): string {
    if (!str) return '';
    return str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c')
        .toLowerCase()
        .trim();
}

/**
 * Capitalizes Turkish words properly across operating systems
 */
export function titleCaseTurkish(str: string): string {
    if (!str) return '';
    const lower = str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLowerCase();
    
    return lower.split(' ').map(word => {
        if (!word) return '';
        const first = word.charAt(0);
        let cap = first.toUpperCase();
        if (first === 'i') cap = 'İ';
        if (first === 'ı') cap = 'I';
        return cap + word.slice(1);
    }).join(' ');
}
