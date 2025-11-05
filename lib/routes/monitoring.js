/**
 * Monitoring routes
 * Provides comprehensive server monitoring, PM2 status, and diagnostics
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const os = require('os');

/**
 * Simple password protection middleware for monitoring routes
 * Requires MONITORING_PASSWORD environment variable
 */
function requireMonitoringAuth(req, res, next) {
    const monitoringPassword = process.env.MONITORING_PASSWORD;
    
    // If no password is set, allow access (for development)
    if (!monitoringPassword) {
        console.warn('⚠️  MONITORING_PASSWORD not set - monitoring routes are unprotected');
        return next();
    }

    // Check for password in query parameter or Authorization header
    const providedPassword = req.query.password || req.headers['x-monitoring-password'];
    
    if (!providedPassword || providedPassword !== monitoringPassword) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Monitoring password required'
        });
    }

    next();
}

/**
 * Create monitoring router
 */
function createMonitoringRouter(supabase) {
    // Apply auth middleware to all monitoring routes
    router.use(requireMonitoringAuth);
    /**
     * GET /api/monitoring/pm2/status
     * Get PM2 process status
     */
    router.get('/pm2/status', async (req, res) => {
        try {
            const { stdout, stderr } = await execPromise('pm2 jlist');
            const processes = JSON.parse(stdout);
            
            res.json({
                success: true,
                processes: processes.map(p => ({
                    name: p.name,
                    pm_id: p.pm_id,
                    pid: p.pid,
                    status: p.pm2_env?.status,
                    restarts: p.pm2_env?.restart_time || 0,
                    uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
                    memory: p.monit?.memory || 0,
                    cpu: p.monit?.cpu || 0,
                    mode: p.pm2_env?.exec_mode,
                    instances: p.pm2_env?.instances || 1
                }))
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                stderr: error.stderr
            });
        }
    });

    /**
     * GET /api/monitoring/pm2/logs
     * Get PM2 logs (last N lines)
     */
    router.get('/pm2/logs', async (req, res) => {
        try {
            const lines = parseInt(req.query.lines) || 100;
            // Try to auto-detect process name, fallback to common names
            let appName = req.query.app;
            if (!appName) {
                try {
                    const { stdout } = await execPromise('pm2 jlist');
                    const processes = JSON.parse(stdout);
                    const detectedProcess = processes.find(p => 
                        p.name === 'docutrainio-bot' || 
                        p.name === 'brightbean-bot' ||
                        (p.pm2_env?.status === 'online' && p.pm2_env?.script?.includes('server.js'))
                    );
                    appName = detectedProcess?.name || 'docutrainio-bot';
                } catch (e) {
                    appName = 'docutrainio-bot'; // Default fallback
                }
            }
            
            const { stdout, stderr } = await execPromise(`pm2 logs ${appName} --lines ${lines} --nostream`);
            
            res.json({
                success: true,
                logs: stdout,
                stderr: stderr
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * GET /api/monitoring/stuck-documents
     * Find documents stuck in processing
     */
    router.get('/stuck-documents', async (req, res) => {
        try {
            const thresholdMinutes = parseInt(req.query.threshold) || 5;
            const thresholdMs = thresholdMinutes * 60 * 1000;
            const cutoffTime = new Date(Date.now() - thresholdMs).toISOString();

            // Find documents stuck in processing
            const { data: stuckDocs, error } = await supabase
                .from('user_documents')
                .select('id, title, status, updated_at, created_at, processing_method, error_message')
                .eq('status', 'processing')
                .lt('updated_at', cutoffTime)
                .order('updated_at', { ascending: true });

            if (error) throw error;

            // Get processing logs for stuck documents
            const stuckWithLogs = await Promise.all(
                (stuckDocs || []).map(async (doc) => {
                    const { data: logs } = await supabase
                        .from('document_processing_logs')
                        .select('*')
                        .eq('user_document_id', doc.id)
                        .order('created_at', { ascending: false })
                        .limit(5);

                    const minutesStuck = Math.round((Date.now() - new Date(doc.updated_at).getTime()) / 1000 / 60);
                    
                    return {
                        ...doc,
                        minutesStuck,
                        lastLog: logs?.[0] || null,
                        recentLogs: logs || []
                    };
                })
            );

            res.json({
                success: true,
                thresholdMinutes,
                stuckCount: stuckWithLogs.length,
                stuckDocuments: stuckWithLogs
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * GET /api/monitoring/processing-stats
     * Get processing statistics
     */
    router.get('/processing-stats', async (req, res) => {
        try {
            const hoursBack = parseInt(req.query.hours) || 24;
            const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

            // Count by status
            const { data: statusCounts, error: statusError } = await supabase
                .from('user_documents')
                .select('status')
                .gte('created_at', cutoffTime);

            if (statusError) throw statusError;

            const statusStats = (statusCounts || []).reduce((acc, doc) => {
                acc[doc.status] = (acc[doc.status] || 0) + 1;
                return acc;
            }, {});

            // Get recent processing logs
            const { data: recentLogs, error: logsError } = await supabase
                .from('document_processing_logs')
                .select('*')
                .gte('created_at', cutoffTime)
                .order('created_at', { ascending: false })
                .limit(50);

            if (logsError) throw logsError;

            // Analyze processing times
            const processingTimes = {};
            const errors = [];

            (recentLogs || []).forEach(log => {
                if (log.stage === 'complete' && log.status === 'completed') {
                    const docId = log.user_document_id;
                    if (!processingTimes[docId]) {
                        processingTimes[docId] = { start: null, end: null };
                    }
                    processingTimes[docId].end = new Date(log.created_at);
                }
                if (log.stage === 'download' && log.status === 'started') {
                    const docId = log.user_document_id;
                    if (!processingTimes[docId]) {
                        processingTimes[docId] = { start: null, end: null };
                    }
                    processingTimes[docId].start = new Date(log.created_at);
                }
                if (log.status === 'failed') {
                    errors.push(log);
                }
            });

            const avgProcessingTimes = Object.values(processingTimes)
                .filter(t => t.start && t.end)
                .map(t => t.end - t.start);

            const avgTime = avgProcessingTimes.length > 0
                ? avgProcessingTimes.reduce((a, b) => a + b, 0) / avgProcessingTimes.length
                : 0;

            res.json({
                success: true,
                hoursBack,
                statusCounts: statusStats,
                totalProcessed: Object.values(statusStats).reduce((a, b) => a + b, 0),
                averageProcessingTimeMs: Math.round(avgTime),
                errorCount: errors.length,
                recentErrors: errors.slice(0, 10)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * GET /api/monitoring/system-info
     * Get system information
     */
    router.get('/system-info', async (req, res) => {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            // Get PM2 info
            let pm2Processes = [];
            try {
                const { stdout } = await execPromise('pm2 jlist');
                const processes = JSON.parse(stdout);
                pm2Processes = processes.map(p => ({
                    name: p.name,
                    status: p.pm2_env?.status,
                    memory: p.monit?.memory || 0,
                    cpu: p.monit?.cpu || 0
                }));
            } catch (pm2Error) {
                // PM2 not available, continue without it
            }

            const pm2TotalMemory = pm2Processes.reduce((sum, p) => sum + (p.memory || 0), 0);
            const pm2TotalCpu = pm2Processes.reduce((sum, p) => sum + (p.cpu || 0), 0);

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    hostname: os.hostname(),
                    uptime: os.uptime(),
                    cpus: os.cpus().length,
                    loadAverage: os.loadavg()
                },
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    usagePercent: Math.round((usedMem / totalMem) * 100)
                },
                pm2: {
                    processes: pm2Processes,
                    totalMemory: pm2TotalMemory,
                    totalCpu: pm2TotalCpu
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * GET /api/monitoring/diagnostics
     * Run comprehensive diagnostics and suggest solutions
     */
    router.get('/diagnostics', async (req, res) => {
        try {
            const diagnostics = {
                timestamp: new Date().toISOString(),
                checks: [],
                issues: [],
                suggestions: []
            };

            // Check 1: PM2 Status
            try {
                const { stdout } = await execPromise('pm2 jlist');
                const processes = JSON.parse(stdout);
                
                // Find any running Node.js server process (look for common names or server.js)
                const appProcess = processes.find(p => 
                    p.name === 'brightbean-bot' || 
                    p.name === 'docutrainio-bot' ||
                    p.name?.includes('server') ||
                    (p.pm2_env?.script?.includes('server.js') && p.pm2_env?.status === 'online')
                ) || processes[0]; // Fallback to first process if no match

                if (!appProcess || processes.length === 0) {
                    diagnostics.checks.push({
                        name: 'PM2 Process',
                        status: 'error',
                        message: 'No PM2 processes found'
                    });
                    diagnostics.issues.push('PM2 process not running');
                    diagnostics.suggestions.push({
                        issue: 'PM2 process not running',
                        solution: 'Run: pm2 start server.js --name docutrainio-bot',
                        severity: 'critical'
                    });
                } else {
                    const isOnline = appProcess.pm2_env?.status === 'online';
                    const restarts = appProcess.pm2_env?.restart_time || 0;
                    const processName = appProcess.name || 'unnamed';
                    
                    diagnostics.checks.push({
                        name: 'PM2 Process',
                        status: isOnline ? 'ok' : 'warning',
                        message: isOnline 
                            ? `Process "${processName}" is ${appProcess.pm2_env?.status} (${restarts} restarts)`
                            : `Process "${processName}" is ${appProcess.pm2_env?.status}`,
                        details: {
                            name: processName,
                            status: appProcess.pm2_env?.status,
                            restarts,
                            memory: appProcess.monit?.memory || 0,
                            cpu: appProcess.monit?.cpu || 0
                        }
                    });

                    if (!isOnline) {
                        diagnostics.issues.push(`PM2 process "${processName}" is not online`);
                        diagnostics.suggestions.push({
                            issue: 'PM2 process not online',
                            solution: `Run: pm2 restart ${processName}`,
                            severity: 'high'
                        });
                    }

                    if (restarts > 10) {
                        diagnostics.issues.push(`High restart count: ${restarts}`);
                        diagnostics.suggestions.push({
                            issue: 'High restart count',
                            solution: `Check logs: pm2 logs ${processName} --lines 100`,
                            severity: 'medium'
                        });
                    }
                }
            } catch (pm2Error) {
                diagnostics.checks.push({
                    name: 'PM2 Process',
                    status: 'error',
                    message: 'Cannot access PM2: ' + pm2Error.message
                });
                diagnostics.issues.push('PM2 not accessible');
            }

            // Check 2: Stuck Documents
            try {
                const thresholdMinutes = 5;
                const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

                const { data: stuckDocs } = await supabase
                    .from('user_documents')
                    .select('id, title, updated_at')
                    .eq('status', 'processing')
                    .lt('updated_at', cutoffTime);

                const stuckCount = stuckDocs?.length || 0;
                
                diagnostics.checks.push({
                    name: 'Stuck Documents',
                    status: stuckCount > 0 ? 'warning' : 'ok',
                    message: stuckCount > 0 
                        ? `${stuckCount} document(s) stuck in processing`
                        : 'No stuck documents',
                    details: {
                        stuckCount,
                        thresholdMinutes
                    }
                });

                if (stuckCount > 0) {
                    diagnostics.issues.push(`${stuckCount} document(s) stuck in processing`);
                    diagnostics.suggestions.push({
                        issue: 'Stuck documents detected',
                        solution: 'Visit /api/monitoring/stuck-documents to see details. Reset stuck documents via API or database.',
                        severity: 'high'
                    });
                }
            } catch (dbError) {
                diagnostics.checks.push({
                    name: 'Stuck Documents',
                    status: 'error',
                    message: 'Cannot check stuck documents: ' + dbError.message
                });
                diagnostics.issues.push('Database connection issue');
            }

            // Check 3: Database Connection
            try {
                const { data, error } = await supabase
                    .from('user_documents')
                    .select('count')
                    .limit(1);

                diagnostics.checks.push({
                    name: 'Database Connection',
                    status: error ? 'error' : 'ok',
                    message: error ? 'Database connection failed' : 'Database connection OK'
                });

                if (error) {
                    diagnostics.issues.push('Database connection failed');
                    diagnostics.suggestions.push({
                        issue: 'Database connection failed',
                        solution: 'Check Supabase credentials and network connectivity',
                        severity: 'critical'
                    });
                }
            } catch (dbError) {
                diagnostics.checks.push({
                    name: 'Database Connection',
                    status: 'error',
                    message: 'Database check failed: ' + dbError.message
                });
            }

            // Check 4: System Resources
            try {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                const memUsagePercent = (usedMem / totalMem) * 100;

                diagnostics.checks.push({
                    name: 'System Resources',
                    status: memUsagePercent > 90 ? 'warning' : 'ok',
                    message: `Memory usage: ${Math.round(memUsagePercent)}%`,
                    details: {
                        totalMem,
                        freeMem,
                        usedMem,
                        usagePercent: Math.round(memUsagePercent)
                    }
                });

                if (memUsagePercent > 90) {
                    diagnostics.issues.push('High memory usage');
                    diagnostics.suggestions.push({
                        issue: 'High memory usage',
                        solution: 'Check for memory leaks or restart server',
                        severity: 'medium'
                    });
                }
            } catch (sysError) {
                diagnostics.checks.push({
                    name: 'System Resources',
                    status: 'error',
                    message: 'Cannot check system resources'
                });
            }

            // Overall status
            diagnostics.overallStatus = diagnostics.issues.length === 0 ? 'healthy' 
                : diagnostics.issues.some(i => i.includes('critical') || i.includes('PM2') || i.includes('Database')) 
                    ? 'critical' 
                    : 'warning';

            res.json({
                success: true,
                ...diagnostics
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * POST /api/monitoring/fix-stuck-document
     * Reset a stuck document to pending status
     */
    router.post('/fix-stuck-document', async (req, res) => {
        try {
            const { documentId } = req.body;

            if (!documentId) {
                return res.status(400).json({
                    success: false,
                    error: 'documentId is required'
                });
            }

            // Check if document is stuck
            const { data: doc, error: fetchError } = await supabase
                .from('user_documents')
                .select('id, status, updated_at')
                .eq('id', documentId)
                .single();

            if (fetchError || !doc) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            if (doc.status !== 'processing') {
                return res.status(400).json({
                    success: false,
                    error: 'Document is not in processing status'
                });
            }

            const minutesStuck = Math.round((Date.now() - new Date(doc.updated_at).getTime()) / 1000 / 60);

            // Reset to pending
            const { error: updateError } = await supabase
                .from('user_documents')
                .update({
                    status: 'pending',
                    error_message: `Reset from stuck processing (was stuck for ${minutesStuck} minutes)`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', documentId);

            if (updateError) throw updateError;

            res.json({
                success: true,
                message: `Document reset to pending (was stuck for ${minutesStuck} minutes)`,
                documentId
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
}

module.exports = {
    createMonitoringRouter
};

