import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AppProviders } from './providers';

/**
 * Root application component.
 * Menyediakan BrowserRouter melalui RouterProvider dan
 * semua global providers melalui AppProviders.
 */
function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
