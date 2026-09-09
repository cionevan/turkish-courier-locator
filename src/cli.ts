import { getProvider, getAllProviders } from './providers';
import { runCarrierScan, ScanOptions } from './scanner';

function parseArgs() {
    const args = process.argv.slice(2);
    let carrier = 'aras';
    let filterIl: string | undefined;
    let filterIlce: string | undefined;
    let fresh = false;
    let concurrency: number | undefined;

    for (const arg of args) {
        if (arg.startsWith('--carrier=')) {
            carrier = arg.split('=')[1].replace(/['"]/g, '').toLowerCase();
        } else if (arg.startsWith('--il=')) {
            filterIl = arg.split('=')[1].replace(/['"]/g, '');
        } else if (arg.startsWith('--ilce=')) {
            filterIlce = arg.split('=')[1].replace(/['"]/g, '');
        } else if (arg === '--fresh') {
            fresh = true;
        } else if (arg.startsWith('--concurrency=')) {
            concurrency = parseInt(arg.split('=')[1], 10);
        }
    }

    if (process.env.npm_lifecycle_event === 'scan:fresh') {
        fresh = true;
    }

    return { carrier, filterIl, filterIlce, fresh, concurrency };
}

async function main() {
    const { carrier, filterIl, filterIlce, fresh, concurrency } = parseArgs();

    const options: ScanOptions = {
        filterIl,
        filterIlce,
        fresh,
        concurrency
    };

    if (carrier === 'all') {
        const providers = getAllProviders();
        for (const provider of providers) {
            await runCarrierScan(provider, options);
        }
    } else {
        const provider = getProvider(carrier);
        await runCarrierScan(provider, options);
    }
}

main().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
