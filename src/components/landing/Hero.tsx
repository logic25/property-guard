import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Shield, Bell } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
            <span className="text-sm font-medium text-primary-foreground/80">NYC Property Compliance Made Simple</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight animate-slide-up">
            Stay ahead of violations.
            <br />
            <span className="text-gradient">Manage everything via SMS.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Threshold automatically monitors NYC violations, coordinates vendors, tracks COIs, and answers lease questions—all through simple text messages.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button variant="hero" size="xl">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="heroDark" size="xl">
              Watch Demo
            </Button>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {[
              { icon: Bell, label: "Violation Alerts" },
              { icon: MessageSquare, label: "SMS-First" },
              { icon: Shield, label: "COI Tracking" },
            ].map((item, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-foreground/5 border border-primary-foreground/10"
              >
                <item.icon className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-primary-foreground/80">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-20 relative animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="max-w-5xl mx-auto">
            <div className="rounded-xl border border-primary-foreground/10 bg-card/5 backdrop-blur-sm p-2 shadow-elevated">
              <div className="rounded-lg bg-card overflow-hidden">
                {/* Mock Dashboard */}
                <div className="p-6">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <span className="font-display font-semibold text-foreground">Property Dashboard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                        3 Active Violations
                      </div>
                    </div>
                  </div>
                  
                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Violation Card */}
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">NEW VIOLATION</span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">FDNY</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">Fire sprinkler inspection overdue</p>
                      <p className="text-xs text-muted-foreground">123 Main St • Due Oct 12</p>
                    </div>
                    
                    {/* SMS Thread Card */}
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">ACTIVE THREAD</span>
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">NYC Fire Safety Inc.</p>
                      <p className="text-xs text-muted-foreground">"Inspection scheduled for..."</p>
                    </div>
                    
                    {/* COI Card */}
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">COI EXPIRING</span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">7 days</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">Elite Plumbing Corp</p>
                      <p className="text-xs text-muted-foreground">Request renewal sent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import { Building2 } from "lucide-react";

export default Hero;
