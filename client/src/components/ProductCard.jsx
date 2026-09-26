import { Link } from 'react-router-dom';
import { useState } from 'react';
import Icon, { ICON_MAP } from './Icons';
import { formatPrice, discountPercent } from '../api';

export default function ProductCard({ product, index = 0 }) {
  const [imgOk, setImgOk] = useState(true);
  const off = discountPercent(product.price, product.mrp);
  const highlights = (product.highlights || []).slice(0, 3);

  return (
    <Link
      to={`/products/${product.slug}`}
      className="pcard reveal"
      style={{ '--i': index }}
    >
      <div className="pcard-media">
        {imgOk ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="pcard-img-fallback">
            <Icon.Drop size={40} />
          </div>
        )}

        <div className="pcard-badges">
          {off > 0 && <span className="badge badge-red">{off}% OFF</span>}
          {product.featured && <span className="badge badge-gold">Bestseller</span>}
        </div>

        {product.veg && (
          <span className="pcard-veg" title="100% vegetarian">
            <span className="veg-mark" />
          </span>
        )}

        {!product.inStock && <div className="pcard-oos">Out of stock</div>}

        <div className="pcard-cta">
          <span>View Details</span>
          <Icon.ArrowRight size={18} />
        </div>
      </div>

      <div className="pcard-body">
        <div className="pcard-top">
          <span className="pcard-cat">{product.category}</span>
          <span className="pcard-rating">
            <Icon.Star size={14} /> {product.rating?.toFixed(1)}
          </span>
        </div>

        <h3 className="pcard-title">{product.shortName || product.name}</h3>
        <p className="pcard-desc">{product.shortDescription}</p>

        {highlights.length > 0 && (
          <ul className="pcard-points">
            {highlights.map((h) => {
              const I = ICON_MAP[h.toLowerCase().split(' ')[0]] || Icon.Check;
              return (
                <li key={h}>
                  <I size={15} />
                  {h}
                </li>
              );
            })}
          </ul>
        )}

        <div className="pcard-foot">
          <div className="pcard-price">
            <span className="pcard-now">{formatPrice(product.price)}</span>
            {product.mrp > product.price && (
              <span className="pcard-mrp">{formatPrice(product.mrp)}</span>
            )}
            {product.packSize && (
              <span className="pcard-size">/ {product.packSize}</span>
            )}
          </div>
          <span className="pcard-arrow">
            <Icon.ArrowRight size={19} />
          </span>
        </div>
      </div>
    </Link>
  );
}
