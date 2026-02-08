import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Shield, MessageSquare } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icons */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[Building2, Shield, MessageSquare].map((Icon, i) => (
              <div 
                key={i}
                className="w-12 h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center animate-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <Icon className="w-6 h-6 text-accent" />
              </div>
            ))}
          </div>

          {/* Heading */}
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Ready to simplify
            <br />
            <span className="text-gradient">property compliance?</span>
          </h2>

          <p className="text-lg text-primary-foreground/70 mb-10 max-w-xl mx-auto">
            Join NYC property owners who manage violations, vendors, and leases—all from their phone.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button variant="hero" size="xl">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="heroDark" size="xl">
              Schedule Demo
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/60">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              14-day free trial
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Cancel anytime
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
