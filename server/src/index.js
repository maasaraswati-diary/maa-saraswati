import 'dotenv/config';
import { app, ensureAdminUser } from './app.js';

/** Local development entry point. On Firebase, `functions.js` is used instead. */
const PORT = Number(process.env.PORT) || 4000;

ensureAdminUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log('');
      console.log('  MAA SARASWATI API');
      console.log(`  ready on  http://localhost:${PORT}/api`);
      console.log(`  admin    http://localhost:${PORT}/api/admin/login`);
      console.log('');
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
