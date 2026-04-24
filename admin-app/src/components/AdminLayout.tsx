import { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import AIAssistantWidget from './AIAssistantWidget';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => (
  <div className="layout-container">
    <AdminSidebar />
    <main className="main-content admin-page">
      {children}
    </main>
    <AIAssistantWidget />
  </div>
);

export default AdminLayout;
