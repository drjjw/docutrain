/**
 * AI Performance Benchmarking Script
 *
 * Measures bottlenecks in the AI response pipeline:
 * - Query embedding time
 * - Document retrieval time
 * - Response generation time
 * - Total response time
 *
 * Tests different combinations:
 * - Models: gemini, grok
 * - Embeddings: openai, local
 * - Documents: smh, uhn, ckd-dc-2025, smh-tx
 * - Query complexity: simple, medium, complex
 */

const API_BASE = 'http://localhost:3456';

// Test queries of different complexities
const testQueries = {
    simple: [
        "What is CKD?",
        "How to treat hypertension?",
        "What medications for diabetes?"
    ],
    medium: [
        "What are the stages of chronic kidney disease and their management?",
        "Explain the protocol for treating hemodialysis catheter infections",
        "What are the contraindications for ACE inhibitors in kidney disease?"
    ],
    complex: [
        "Compare and contrast the management approaches for diabetic nephropathy versus other causes of CKD, including specific medication adjustments, monitoring parameters, and when to involve nephrology specialists",
        "Describe the complete protocol for managing a patient with end-stage renal disease who develops sepsis, including antibiotic selection, fluid management, dialysis considerations, and monitoring requirements",
        "Explain the pathophysiology of renal osteodystrophy and detail the comprehensive management strategy including phosphate binders, vitamin D analogs, calcimimetics, and surgical interventions"
    ]
};

// Test configurations
const configs = [
    { model: 'gemini', embedding: 'openai', doc: 'smh' },
    { model: 'gemini', embedding: 'local', doc: 'ckd-dc-2025' },
    { model: 'grok', embedding: 'openai', doc: 'smh' },
    { model: 'grok', embedding: 'local', doc: 'ckd-dc-2025' },
    { model: 'gemini', embedding: 'openai', doc: 'uhn' },
    { model: 'gemini', embedding: 'local', doc: 'smh-tx' }
];

class BenchmarkRunner {
    constructor() {
        this.results = [];
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async makeRequest(query, config) {
        const startTime = Date.now();

        try {
            const url = new URL(`${API_BASE}/api/chat`);
            url.searchParams.set('doc', config.doc);
            url.searchParams.set('embedding', config.embedding);
            url.searchParams.set('method', 'rag');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: query,
                    sessionId: this.sessionId,
                    model: config.model
                }),
                // timeout: 60000 // 60 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const totalTime = Date.now() - startTime;

            return {
                success: true,
                totalTime,
                responseLength: data.response?.length || 0,
                data: data
            };
        } catch (error) {
            const totalTime = Date.now() - startTime;

            return {
                success: false,
                totalTime,
                error: error.message,
                data: null
            };
        }
    }

    async runBenchmark() {
        console.log('🚀 Starting AI Performance Benchmarks\n');
        console.log('=' .repeat(80));

        // Test each configuration with each query type
        for (const config of configs) {
            console.log(`\n📊 Testing: ${config.model} + ${config.embedding} + ${config.doc}`);
            console.log('-'.repeat(60));

            for (const [complexity, queries] of Object.entries(testQueries)) {
                console.log(`\n${complexity.toUpperCase()} queries:`);

                for (const query of queries) {
                    console.log(`  "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

                    // Make request and measure
                    const result = await this.makeRequest(query, config);

                    this.results.push({
                        ...config,
                        complexity,
                        query,
                        ...result
                    });

                    if (result.success) {
                        console.log(`    ✅ ${result.totalTime}ms (${result.responseLength} chars)`);
                    } else {
                        console.log(`    ❌ ${result.totalTime}ms - ${result.error}`);
                    }

                    // Small delay between requests to avoid overwhelming the server
                    await this.sleep(1000);
                }
            }
        }

        this.analyzeResults();
    }

    analyzeResults() {
        console.log('\n📈 BENCHMARK RESULTS ANALYSIS');
        console.log('=' .repeat(80));

        // Group results by configuration
        const configStats = {};

        this.results.forEach(result => {
            const key = `${result.model}-${result.embedding}-${result.doc}`;

            if (!configStats[key]) {
                configStats[key] = {
                    config: result,
                    totalRequests: 0,
                    successfulRequests: 0,
                    totalTime: 0,
                    byComplexity: { simple: [], medium: [], complex: [] }
                };
            }

            configStats[key].totalRequests++;
            configStats[key].byComplexity[result.complexity].push(result.totalTime);

            if (result.success) {
                configStats[key].successfulRequests++;
                configStats[key].totalTime += result.totalTime;
            }
        });

        // Calculate averages
        Object.entries(configStats).forEach(([key, stats]) => {
            const successRate = (stats.successfulRequests / stats.totalRequests * 100).toFixed(1);

            console.log(`\n${key}:`);
            console.log(`  Success Rate: ${successRate}% (${stats.successfulRequests}/${stats.totalRequests})`);

            if (stats.successfulRequests > 0) {
                const avgTime = Math.round(stats.totalTime / stats.successfulRequests);
                console.log(`  Average Response Time: ${avgTime}ms`);

                // Complexity breakdown
                Object.entries(stats.byComplexity).forEach(([complexity, times]) => {
                    if (times.length > 0) {
                        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                        const min = Math.min(...times);
                        const max = Math.max(...times);
                        console.log(`    ${complexity}: ${avg}ms (min: ${min}ms, max: ${max}ms)`);
                    }
                });
            }
        });

        // Identify bottlenecks
        console.log('\n🔍 BOTTLENECK ANALYSIS');
        console.log('-'.repeat(40));

        // Find slowest configurations
        const sortedConfigs = Object.entries(configStats)
            .filter(([, stats]) => stats.successfulRequests > 0)
            .map(([key, stats]) => ({
                key,
                avgTime: stats.totalTime / stats.successfulRequests,
                successRate: stats.successfulRequests / stats.totalRequests
            }))
            .sort((a, b) => b.avgTime - a.avgTime);

        console.log('Slowest configurations:');
        sortedConfigs.slice(0, 3).forEach((config, i) => {
            console.log(`  ${i+1}. ${config.key}: ${Math.round(config.avgTime)}ms`);
        });

        // Check for complexity impact
        console.log('\nComplexity impact:');
        const complexityTimes = { simple: [], medium: [], complex: [] };

        this.results.forEach(result => {
            if (result.success) {
                complexityTimes[result.complexity].push(result.totalTime);
            }
        });

        Object.entries(complexityTimes).forEach(([complexity, times]) => {
            if (times.length > 0) {
                const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                console.log(`  ${complexity}: ${avg}ms average`);
            }
        });

        console.log('\n✅ Benchmark complete!');
        console.log('📊 Results saved to benchmark results above');
    }
}

// Run the benchmark if this script is executed directly
if (require.main === module) {
    console.log('⏳ Warming up server...');
    // Give server time to start if not already running
    setTimeout(() => {
        const benchmark = new BenchmarkRunner();
        benchmark.runBenchmark().catch(console.error);
    }, 2000);
}

module.exports = BenchmarkRunner;
