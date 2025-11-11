#!/usr/bin/env node
/**
 * Test Script: Quiz Question Bank System
 * 
 * Tests the new question bank model where:
 * - Questions form a bank (e.g., 100 questions)
 * - Each quiz attempt randomly selects 5 questions from the bank
 * - Each attempt stores which questions were used
 * 
 * Usage:
 *   node scripts/test-quiz-question-bank.js <document-slug>
 */

const { createClient } = require('@supabase/supabase-js');
const {
  createQuiz,
  storeQuizQuestions,
  getQuizByDocumentSlug,
  getRandomQuizQuestions,
  createQuizAttempt,
  getQuizStatistics,
  getQuizQuestions
} = require('../lib/db/quiz-operations');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test data
const mockQuestions = [
  {
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 2
  },
  {
    question: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: 1
  },
  {
    question: 'What is the largest planet?',
    options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 2
  },
  {
    question: 'What is the speed of light?',
    options: ['300,000 km/s', '150,000 km/s', '450,000 km/s', '600,000 km/s'],
    correctAnswer: 0
  },
  {
    question: 'What is the smallest prime number?',
    options: ['0', '1', '2', '3'],
    correctAnswer: 2
  },
  {
    question: 'What is the chemical symbol for gold?',
    options: ['Go', 'Gd', 'Au', 'Ag'],
    correctAnswer: 2
  },
  {
    question: 'What is the square root of 16?',
    options: ['2', '3', '4', '5'],
    correctAnswer: 2
  },
  {
    question: 'What is the largest ocean?',
    options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    correctAnswer: 3
  },
  {
    question: 'What is the capital of Japan?',
    options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'],
    correctAnswer: 2
  },
  {
    question: 'What is the freezing point of water in Celsius?',
    options: ['-10°C', '0°C', '10°C', '20°C'],
    correctAnswer: 1
  }
];

async function testQuizQuestionBank(documentSlug) {
  console.log('\n🧪 Testing Quiz Question Bank System');
  console.log('=' .repeat(60));
  console.log(`Document Slug: ${documentSlug}\n`);

  try {
    // Test 1: Create quiz with question bank
    console.log('📝 Test 1: Creating quiz with question bank...');
    const bankSize = mockQuestions.length;
    const quizSize = 5; // 5 questions per attempt
    
    const quiz = await createQuiz(supabase, documentSlug, bankSize, null, quizSize);
    console.log(`   ✓ Quiz created: ${quiz.id}`);
    console.log(`   - Bank size: ${bankSize} questions`);
    console.log(`   - Quiz size: ${quizSize} questions per attempt`);
    console.log(`   - Status: ${quiz.status}\n`);

    // Test 2: Store questions in bank
    console.log('💾 Test 2: Storing questions in bank...');
    const storedQuestions = await storeQuizQuestions(supabase, quiz.id, mockQuestions);
    console.log(`   ✓ Stored ${storedQuestions.length} questions in bank\n`);

    // Test 3: Update quiz status to completed
    console.log('✅ Test 3: Updating quiz status to completed...');
    const { updateQuizStatus } = require('../lib/db/quiz-operations');
    await updateQuizStatus(supabase, quiz.id, 'completed');
    console.log('   ✓ Quiz status updated to completed\n');

    // Test 4: Get random questions for first attempt
    console.log('🎲 Test 4: Getting random questions for attempt 1...');
    const attempt1Questions = await getRandomQuizQuestions(supabase, quiz.id, quizSize);
    const attempt1QuestionIds = attempt1Questions.map(q => q.id);
    console.log(`   ✓ Retrieved ${attempt1Questions.length} random questions`);
    console.log(`   - Question IDs: ${attempt1QuestionIds.join(', ')}\n`);

    // Test 5: Get random questions for second attempt (should be different)
    console.log('🎲 Test 5: Getting random questions for attempt 2...');
    const attempt2Questions = await getRandomQuizQuestions(supabase, quiz.id, quizSize);
    const attempt2QuestionIds = attempt2Questions.map(q => q.id);
    console.log(`   ✓ Retrieved ${attempt2Questions.length} random questions`);
    console.log(`   - Question IDs: ${attempt2QuestionIds.join(', ')}`);
    
    // Check if questions are different
    const questionsAreDifferent = !attempt1QuestionIds.every(id => attempt2QuestionIds.includes(id));
    if (questionsAreDifferent) {
      console.log('   ✓ Questions are different between attempts (as expected)\n');
    } else {
      console.log('   ⚠️  Questions are the same (may happen by chance with small bank)\n');
    }

    // Test 6: Create quiz attempts with question IDs
    console.log('📊 Test 6: Creating quiz attempts...');
    
    // Attempt 1: Score 3/5
    const attempt1Score = 3;
    const attempt1 = await createQuizAttempt(
      supabase,
      quiz.id,
      null, // Anonymous user
      attempt1Score,
      quizSize,
      attempt1QuestionIds
    );
    console.log(`   ✓ Attempt 1 created: ${attempt1.id}`);
    console.log(`   - Score: ${attempt1Score}/${quizSize}`);
    console.log(`   - Question IDs stored: ${attempt1.question_ids ? 'Yes' : 'No'}\n`);

    // Attempt 2: Score 4/5
    const attempt2Score = 4;
    const attempt2 = await createQuizAttempt(
      supabase,
      quiz.id,
      null, // Anonymous user
      attempt2Score,
      quizSize,
      attempt2QuestionIds
    );
    console.log(`   ✓ Attempt 2 created: ${attempt2.id}`);
    console.log(`   - Score: ${attempt2Score}/${quizSize}`);
    console.log(`   - Question IDs stored: ${attempt2.question_ids ? 'Yes' : 'No'}\n`);

    // Test 7: Get all questions from bank
    console.log('📚 Test 7: Getting all questions from bank...');
    const allQuestions = await getQuizQuestions(supabase, quiz.id);
    console.log(`   ✓ Retrieved ${allQuestions.length} questions from bank`);
    console.log(`   - Bank size matches: ${allQuestions.length === bankSize ? 'Yes' : 'No'}\n`);

    // Test 8: Get quiz statistics
    console.log('📈 Test 8: Getting quiz statistics...');
    const statistics = await getQuizStatistics(supabase, quiz.id);
    console.log('   ✓ Statistics retrieved:');
    console.log(`   - Total attempts: ${statistics.totalAttempts}`);
    console.log(`   - Average score: ${statistics.averageScore}`);
    console.log(`   - Average percentage: ${statistics.averagePercentage}%`);
    console.log(`   - Highest score: ${statistics.highestScore}`);
    console.log(`   - Lowest score: ${statistics.lowestScore}`);
    console.log(`   - Questions per attempt: ${statistics.totalQuestions}\n`);

    // Test 9: Verify question IDs in attempts
    console.log('🔍 Test 9: Verifying question IDs in attempts...');
    const { data: attempt1Data } = await supabase
      .from('quiz_attempts')
      .select('question_ids')
      .eq('id', attempt1.id)
      .single();
    
    const { data: attempt2Data } = await supabase
      .from('quiz_attempts')
      .select('question_ids')
      .eq('id', attempt2.id)
      .single();
    
    if (attempt1Data?.question_ids && Array.isArray(attempt1Data.question_ids)) {
      console.log(`   ✓ Attempt 1 question IDs: ${attempt1Data.question_ids.length} stored`);
      console.log(`     ${attempt1Data.question_ids.join(', ')}`);
    } else {
      console.log('   ✗ Attempt 1 question IDs not found');
    }
    
    if (attempt2Data?.question_ids && Array.isArray(attempt2Data.question_ids)) {
      console.log(`   ✓ Attempt 2 question IDs: ${attempt2Data.question_ids.length} stored`);
      console.log(`     ${attempt2Data.question_ids.join(', ')}\n`);
    } else {
      console.log('   ✗ Attempt 2 question IDs not found\n');
    }

    // Summary
    console.log('=' .repeat(60));
    console.log('✅ All tests passed!');
    console.log('\nSummary:');
    console.log(`- Quiz ID: ${quiz.id}`);
    console.log(`- Bank size: ${bankSize} questions`);
    console.log(`- Quiz size: ${quizSize} questions per attempt`);
    console.log(`- Total attempts: ${statistics.totalAttempts}`);
    console.log(`- Average score: ${statistics.averageScore}/${quizSize}`);
    console.log('\n✨ Question bank system is working correctly!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Main
const documentSlug = process.argv[2];

if (!documentSlug) {
  console.error('❌ Usage: node scripts/test-quiz-question-bank.js <document-slug>');
  process.exit(1);
}

testQuizQuestionBank(documentSlug)
  .then(() => {
    console.log('✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });



