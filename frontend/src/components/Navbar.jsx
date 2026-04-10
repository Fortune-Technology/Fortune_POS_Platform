/**
 * Navigation Component
 * Top navigation bar
 */

import { Link, useLocation } from 'react-router-dom';
import StoreveuLogo from './StoreveuLogo';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <nav className="nav-bar">
            <div className="container">
                <div className="flex-between nav-inner">
                    <Link to="/" className="nav-logo">
                        <StoreveuLogo height={32} darkMode={true} />
                    </Link>

                    <div className="nav-links">
                        <Link to="/" className={`btn btn-sm ${isActive('/') ? 'btn-primary' : 'btn-secondary'}`}>Upload</Link>
                        <Link to="/deposit-map" className={`btn btn-sm ${isActive('/deposit-map') ? 'btn-primary' : 'btn-secondary'}`}>Deposit Map</Link>
                        <Link to="/history" className={`btn btn-sm ${isActive('/history') ? 'btn-primary' : 'btn-secondary'}`}>History</Link>
                        <Link to="/ocr" className={`btn btn-sm ${isActive('/ocr') ? 'btn-primary' : 'btn-secondary'}`}>OCR</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
