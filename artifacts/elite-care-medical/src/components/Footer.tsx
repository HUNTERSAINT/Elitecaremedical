import { Link } from 'wouter';
import { MapPin, Mail, Phone, MessageCircle } from 'lucide-react';
import logoPath from '@assets/logo.png';

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoPath} alt="Elite Care Medical" className="h-10 w-10 object-contain brightness-[10]" />
              <div>
                <div className="font-serif text-lg font-bold leading-tight">Elite Care Medical</div>
                <div className="text-[10px] font-medium tracking-widest text-primary-foreground/60 uppercase leading-tight">Lagos, Nigeria</div>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              Nigeria's trusted supplier of professional medical equipment for hospitals, clinics, laboratories, and healthcare professionals.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm tracking-wider uppercase mb-4 text-primary-foreground/80">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Home' },
                { href: '/shop', label: 'Shop All Products' },
                { href: '/cart', label: 'Shopping Cart' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors" data-testid={`link-footer-${link.label.toLowerCase().replace(/\s/g, '-')}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm tracking-wider uppercase mb-4 text-primary-foreground/80">Contact Us</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:Nkingsley130@gmail.com" className="flex items-start gap-2.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors" data-testid="link-footer-email">
                  <Mail size={15} className="mt-0.5 shrink-0" />
                  <span>Nkingsley130@gmail.com</span>
                </a>
              </li>
              <li>
                <a href="https://wa.me/2347065599931" target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors" data-testid="link-footer-whatsapp">
                  <MessageCircle size={15} className="mt-0.5 shrink-0" />
                  <span>+234 706 559 9931</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-2.5 text-sm text-primary-foreground/70">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  <span>Lagos, Nigeria</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h4 className="font-semibold text-sm tracking-wider uppercase mb-4 text-primary-foreground/80">Our Promise</h4>
            <ul className="space-y-2">
              {[
                'NAFDAC Registered Supplier',
                'Genuine Products Guaranteed',
                'Fast Delivery Nationwide',
                '24/7 WhatsApp Support',
                'Bulk Order Discounts',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-primary-foreground/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-primary-foreground/15 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/50">
            &copy; {new Date().getFullYear()} Elite Care Medical. All rights reserved.
          </p>
          <a
            href="https://wa.me/2347065599931"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#20bd5a] transition-colors"
            data-testid="link-whatsapp-footer"
          >
            <MessageCircle size={16} />
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
