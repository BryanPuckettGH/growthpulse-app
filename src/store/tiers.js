// Subscription tiers. Demo mode: "buying" instantly unlocks the tier, no billing.
// Real Stripe billing comes at the backend phase (see the product roadmap).
export const TIERS = {
  free: {
    id: 'free', name: 'Free', price: '$0', period: '', tagline: 'For a few house plants',
    color: '#8b97a6', deviceLimit: 3, weather: false, irrigation: false,
    perks: ['Up to 3 devices', 'Full plant database', 'Live monitoring', 'Basic alarms', 'History charts'],
  },
  plus: {
    id: 'plus', name: 'Plus', price: '$4.99', period: '/mo', tagline: 'For plant lovers',
    color: '#13a4ff', deviceLimit: 10, weather: true, irrigation: false,
    perks: ['Up to 10 devices', 'Everything in Free', 'Weather rain gauge', 'Smart watering alerts', 'Priority support'],
  },
  pro: {
    id: 'pro', name: 'Pro', price: '$9.99', period: '/mo', tagline: 'For the whole yard',
    color: '#2ecc71', deviceLimit: 99, weather: true, irrigation: true,
    perks: ['Unlimited devices', 'Everything in Plus', 'Yard zones', 'Automated irrigation', 'LoRaWAN long range'],
  },
};

export const TIER_ORDER = ['free', 'plus', 'pro'];
