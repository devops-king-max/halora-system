import { createApp } from './app';
import { settings } from './core/config';
createApp().then(app=>app.listen(settings.port,'0.0.0.0')).catch(error=>{
  // Configuration keys and exception stacks are safe to diagnose; never print env/config.
  console.error(error instanceof Error?error.message:'API startup failed');process.exitCode=1;
});
