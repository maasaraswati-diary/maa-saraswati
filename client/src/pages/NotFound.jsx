import { Link } from 'react-router-dom';
import Icon from '../components/Icons';

export default function NotFound() {
  return (
    <section className="nf-sec">
      <div className="nf-bg" aria-hidden="true" />
      <div className="container nf-in">
        <span className="nf-code">404</span>
        <h1 className="h2">
          This page took a <span className="serif-it hl">wrong turn</span>
        </h1>
        <p className="lead">
          The page you are looking for does not exist, or it may have been
          moved. Let&apos;s get you back to the good stuff.
        </p>
        <div className="nf-actions">
          <Link to="/" className="btn btn-red btn-lg">
            <Icon.ArrowLeft size={18} /> Back to Home
          </Link>
          <Link to="/products" className="btn btn-ghost btn-lg">
            Browse Products
          </Link>
        </div>
      </div>
    </section>
  );
}
