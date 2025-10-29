import { selfProgrammingService } from './selfProgrammingService';
import { driveSyncService } from './driveSyncService';
import { db } from './indexedDBService';

const THREAD_DELAY_THRESHOLD = 100; // ms, a 100ms delay on a 10ms timer indicates heavy load
const LOW_BATTERY_THRESHOLD = 0.20; // 20%
const CRITICAL_MEMORY_THRESHOLD = 450; // 450MB (simulated)

class SystemMonitor {
    private monitorInterval: number | null = null;
    private userId: string | null = null;
    private getGoogleToken: (() => string | null) | null = null;
    private isUnderStrain: boolean = false;
    private strainReason: string = 'Normal';

    start(userId: string, getGoogleToken: () => string | null) {
        if (this.monitorInterval) return;
        this.userId = userId;
        this.getGoogleToken = getGoogleToken;
        console.log('[SystemMonitor] Starting performance monitoring.');
        this.checkPerformance(); // Initial check
        if ('getBattery' in navigator) {
            (navigator as any).getBattery().then((battery: any) => {
                battery.addEventListener('levelchange', () => this.checkPerformance());
                battery.addEventListener('chargingchange', () => this.checkPerformance());
            });
        }
        this.monitorInterval = window.setInterval(() => this.checkPerformance(), 15 * 1000); // Check every 15s
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('[SystemMonitor] Stopped performance monitoring.');
        }
    }

    public isDeviceUnderStrain = (): boolean => this.isUnderStrain;
    public getStrainReason = (): string => this.strainReason;

    private checkBattery = async (): Promise<{ underStrain: boolean, reason: string }> => {
        if ('getBattery' in navigator) {
            try {
                const battery = await (navigator as any).getBattery();
                if (!battery.charging && battery.level < LOW_BATTERY_THRESHOLD) {
                    return { underStrain: true, reason: 'Bateria Baixa' };
                }
            } catch (error) {
                console.warn('[SystemMonitor] Could not access battery status.');
            }
        }
        return { underStrain: false, reason: '' };
    }

    private checkMainThread = (): Promise<{ underStrain: boolean, reason: string }> => {
        return new Promise(resolve => {
            const startTime = performance.now();
            setTimeout(() => {
                const delay = performance.now() - startTime - 10; // subtract approximate interval time
                if (delay > THREAD_DELAY_THRESHOLD) {
                    resolve({ underStrain: true, reason: 'Alta Carga de CPU' });
                } else {
                    resolve({ underStrain: false, reason: '' });
                }
            }, 10);
        });
    }

    private async checkPerformance() {
        if (!this.userId) return;

        const batteryCheck = await this.checkBattery();
        const threadCheck = await this.checkMainThread();

        const oldStrain = this.isUnderStrain;
        let newStrain = false;
        let newReason = 'Normal';

        if (batteryCheck.underStrain) {
            newStrain = true;
            newReason = batteryCheck.reason;
        } else if (threadCheck.underStrain) {
            newStrain = true;
            newReason = threadCheck.reason;
        }

        if (oldStrain !== newStrain) {
            this.isUnderStrain = newStrain;
            this.strainReason = newReason;
            console.log(`[SystemMonitor] Strain status changed to: ${this.isUnderStrain} (Reason: ${this.strainReason})`);
            window.dispatchEvent(new CustomEvent('nexus-performance-update', {
                detail: { isUnderStrain: this.isUnderStrain, reason: this.strainReason }
            }));
        }
    }
}

export const systemMonitor = new SystemMonitor();