import type { QuestionPack } from '../src/types';

/** Two categories of five, so a test can finish a whole board quickly. */
export const MOCK_PACK: QuestionPack = {
  id: 'test-pack',
  name: 'Test Pack',
  topic: 'music',
  version: '1.0',
  categories: [
    {
      name: 'Animals',
      questions: [
        { id: 'a-1', level: 1, points: 100, targetWord: 'cat', songTitle: 'Cat Song', artist: 'Test', hint: 'Meow' },
        { id: 'a-2', level: 2, points: 200, targetWord: 'dog', songTitle: 'Dog Song', artist: 'Test', hint: 'Woof' },
        { id: 'a-3', level: 3, points: 300, targetWord: 'bird', songTitle: 'Bird Song', artist: 'Test' },
        { id: 'a-4', level: 4, points: 400, targetWord: 'fish', songTitle: 'Fish Song', artist: 'Test' },
        { id: 'a-5', level: 5, points: 500, targetWord: 'lion', songTitle: 'Lion Song', artist: 'Test' },
      ],
    },
    {
      name: 'Food',
      questions: [
        { id: 'f-1', level: 1, points: 100, targetWord: 'apple', songTitle: 'Apple Song', artist: 'Test' },
        { id: 'f-2', level: 2, points: 200, targetWord: 'banana', songTitle: 'Banana Song', artist: 'Test' },
        { id: 'f-3', level: 3, points: 300, targetWord: 'cake', songTitle: 'Cake Song', artist: 'Test' },
        { id: 'f-4', level: 4, points: 400, targetWord: 'pie', songTitle: 'Pie Song', artist: 'Test' },
        { id: 'f-5', level: 5, points: 500, targetWord: 'sushi', songTitle: 'Sushi Song', artist: 'Test' },
      ],
    },
  ],
};
