#!/usr/bin/env node

/**
 * Monitoring Script
 * 
 * Comprehensive server monitoring script that can run locally or on production
 * Checks PM2 status, stuck documents, system resources, and provides diagnostics
 * 
 * Usage:
 *   node scripts/monitor.js [options]
 * 
 * Options:
 *   --watch       Watch mode - refresh every 30 seconds
 *   --json        Output as JSON
 *   --fix-stuck   Automatically fix stuck documents
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const os = require('os');

const execAsync = util.promisify(exec);

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    if (process.stdout.isTTY) {
        return `${colors[color]}${text}${colors.reset}`;
    }
    return text;
}

// Initialize Supabase
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    supabaseKey
);

/**
 * Get PM2 status
 */
async function getPM2Status() {
    try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        return { success: true, processes };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get stuck documents
 */
async function getStuckDocuments(thresholdMinutes = 5) {
    try {
        const thresholdMs = thresholdMinutes * 60 * 1000;
        const cutoffTime = new Date(Date.now() - thresholdMs).toISOString();

        const { data: stuckDocs, error } = await supabase
            .from('user_documents')
            .select('id, title, status, updated_at, created_at, processing_method, error_message')
            .eq('status', 'processing')
            .lt('updated_at', cutoffTime)
            .order('updated_at', { ascending: true });

        if (error) throw error;

        return { success: true, documents: stuckDocs || [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get system info
 */
function getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    return {
        platform: os.platform(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpus: os.cpus().length,
        loadAverage: os.loadavg(),
        memory: {
            total: totalMem,
            free: freeMem,
            used: usedMem,
            usagePercent: Math.round(memUsagePercent)
        }
    };
}

/**
 * Reset stuck document
 */
async function resetStuckDocument(documentId) {
    try {
        const { data: doc } = await supabase
            .from('user_documents')
            .select('id, status, updated_at')
            .eq('id', documentId)
            .single();

        if (!doc || doc.status !== 'processing') {
            return { success: false, error: 'Document not found or not in processing' };
        }

        const minutesStuck = Math.round((Date.now() - new Date(doc.updated_at).getTime()) / 1000 / 60);

        const { error } = await supabase
            .from('user_documents')
            .update({
                status: 'pending',
                error_message: `Reset from stuck processing (was stuck for ${minutesStuck} minutes)`,
                updated_at: new Date().toISOString()
            })
            .eq('id', documentId);

        if (error) throw error;

        return { success: true, minutesStuck };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Print formatted output
 */
function printStatus(pm2Status, stuckDocs, systemInfo, isJson = false) {
    if (isJson) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            pm2: pm2Status,
            stuckDocuments: stuckDocs,
            system: systemInfo
        }, null, 2));
        return;
    }

    // Clear screen (if not in watch mode, this won't matter)
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J\x1b[0f');
    }

    console.log(colorize('='.repeat(70), 'cyan'));
    console.log(colorize('  SERVER MONITORING DASHBOARD', 'bright'));
    console.log(colorize('  ' + new Date().toLocaleString(), 'cyan'));
    console.log(colorize('='.repeat(70), 'cyan'));
    console.log();

    // PM2 Status
    console.log(colorize('📊 PM2 STATUS', 'bright'));
    console.log('-'.repeat(70));
    if (pm2Status.success && pm2Status.processes.length > 0) {
        pm2Status.processes.forEach(p => {
            const status = p.pm2_env?.status;
            const statusColor = status === 'online' ? 'green' : 'red';
            const restarts = p.pm2_env?.restart_time || 0;
            const memoryMB = Math.round((p.monit?.memory || 0) / 1024 / 1024);
            const cpu = p.monit?.cpu || 0;

            console.log(`  ${colorize('●', statusColor)} ${p.name || 'unnamed'}`);
            console.log(`    Status: ${colorize(status.toUpperCase(), statusColor)}`);
            console.log(`    PID: ${p.pid || 'N/A'}`);
            console.log(`    Restarts: ${colorize(restarts.toString(), restarts > 10 ? 'yellow' : 'reset')}`);
            console.log(`    Memory: ${memoryMB}MB`);
            console.log(`    CPU: ${cpu.toFixed(1)}%`);
            console.log();
        });
    } else {
        console.log(colorize('  ⚠️  PM2 not accessible or no processes found', 'yellow'));
        if (pm2Status.error) {
            console.log(`     Error: ${pm2Status.error}`);
        }
        console.log();
    }

    // Stuck Documents
    console.log(colorize('📄 STUCK DOCUMENTS', 'bright'));
    console.log('-'.repeat(70));
    if (stuckDocs.success && stuckDocs.documents.length > 0) {
        console.log(colorize(`  ⚠️  Found ${stuckDocs.documents.length} stuck document(s):`, 'yellow'));
        stuckDocs.documents.forEach(doc => {
            const minutesStuck = Math.round((Date.now() - new Date(doc.updated_at).getTime()) / 1000 / 60);
            console.log(`    • ${doc.title || doc.id}`);
            console.log(`      Stuck for: ${colorize(`${minutesStuck} minutes`, 'yellow')}`);
            console.log(`      Updated: ${new Date(doc.updated_at).toLocaleString()}`);
            console.log(`      Method: ${doc.processing_method || 'unknown'}`);
            console.log();
        });
    } else {
        console.log(colorize('  ✓ No stuck documents', 'green'));
        console.log();
    }

    // System Info
    console.log(colorize('💻 SYSTEM RESOURCES', 'bright'));
    console.log('-'.repeat(70));
    console.log(`  Hostname: ${systemInfo.hostname}`);
    console.log(`  Platform: ${systemInfo.platform}`);
    console.log(`  Uptime: ${Math.round(systemInfo.uptime / 3600)} hours`);
    console.log(`  CPUs: ${systemInfo.cpus}`);
    console.log(`  Load Average: ${systemInfo.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
    
    const memColor = systemInfo.memory.usagePercent > 90 ? 'red' : systemInfo.memory.usagePercent > 75 ? 'yellow' : 'green';
    console.log(`  Memory Usage: ${colorize(`${systemInfo.memory.usagePercent}%`, memColor)}`);
    console.log(`    Total: ${Math.round(systemInfo.memory.total / 1024 / 1024 / 1024)}GB`);
    console.log(`    Used: ${Math.round(systemInfo.memory.used / 1024 / 1024 / 1024)}GB`);
    console.log(`    Free: ${Math.round(systemInfo.memory.free / 1024 / 1024 / 1024)}GB`);
    console.log();

    // Suggestions
    const suggestions = [];
    if (pm2Status.success && pm2Status.processes.length > 0) {
        const badProcess = pm2Status.processes.find(p => p.pm2_env?.status !== 'online');
        if (badProcess) {
            const processName = badProcess.name || badProcess.pm2_env?.name || 'docutrainio-bot';
            suggestions.push({
                issue: 'PM2 process not online',
                solution: `pm2 restart ${processName}`,
                severity: 'high'
            });
        }

        const highRestarts = pm2Status.processes.find(p => (p.pm2_env?.restart_time || 0) > 10);
        if (highRestarts) {
            const processName = highRestarts.name || highRestarts.pm2_env?.name || 'docutrainio-bot';
            suggestions.push({
                issue: 'High restart count',
                solution: `pm2 logs ${processName} --lines 100`,
                severity: 'medium'
            });
        }
    }

    if (stuckDocs.success && stuckDocs.documents.length > 0) {
        suggestions.push({
            issue: `${stuckDocs.documents.length} stuck document(s)`,
            solution: 'Run: node scripts/monitor.js --fix-stuck',
            severity: 'high'
        });
    }

    if (systemInfo.memory.usagePercent > 90) {
        suggestions.push({
            issue: 'High memory usage',
            solution: 'Check for memory leaks or restart server',
            severity: 'medium'
        });
    }

    if (suggestions.length > 0) {
        console.log(colorize('💡 SUGGESTIONS', 'bright'));
        console.log('-'.repeat(70));
        suggestions.forEach(s => {
            const severityColor = s.severity === 'high' ? 'red' : 'yellow';
            console.log(`  ${colorize('●', severityColor)} ${s.issue}`);
            console.log(`    → ${s.solution}`);
            console.log();
        });
    } else {
        console.log(colorize('  ✓ All systems operational', 'green'));
        console.log();
    }

    console.log(colorize('='.repeat(70), 'cyan'));
}

/**
 * Main monitoring function
 */
async function monitor(options = {}) {
    const { watch = false, json = false, fixStuck = false } = options;

    try {
        // Get status
        const pm2Status = await getPM2Status();
        const stuckDocs = await getStuckDocuments(5);
        const systemInfo = getSystemInfo();

        // Print status
        printStatus(pm2Status, stuckDocs, systemInfo, json);

        // Auto-fix stuck documents if requested
        if (fixStuck && stuckDocs.success && stuckDocs.documents.length > 0) {
            console.log(colorize('\n🔧 Fixing stuck documents...', 'yellow'));
            for (const doc of stuckDocs.documents) {
                const result = await resetStuckDocument(doc.id);
                if (result.success) {
                    console.log(colorize(`  ✓ Reset: ${doc.title || doc.id} (was stuck for ${result.minutesStuck} minutes)`, 'green'));
                } else {
                    console.log(colorize(`  ✗ Failed: ${doc.id} - ${result.error}`, 'red'));
                }
            }
        }

        // Watch mode
        if (watch) {
            setTimeout(() => {
                monitor(options);
            }, 30000); // Refresh every 30 seconds
        }
    } catch (error) {
        console.error(colorize('Error:', 'red'), error.message);
        if (!watch) {
            process.exit(1);
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    watch: args.includes('--watch'),
    json: args.includes('--json'),
    fixStuck: args.includes('--fix-stuck')
};

// Run monitoring
monitor(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

