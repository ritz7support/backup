import { Construction } from 'lucide-react';

export default function ComingSoonPage({ title = "Coming Soon", description = "This feature is under development and will be available soon." }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E6EFFA' }}>
            <Construction className="h-12 w-12" style={{ color: '#0462CB' }} />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: '#011328' }}>{title}</h1>
        <p className="text-lg" style={{ color: '#8E8E8E' }}>{description}</p>
        <div className="mt-8 flex justify-center gap-2">
          <div className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#0462CB', animationDelay: '0ms' }}></div>
          <div className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#0462CB', animationDelay: '150ms' }}></div>
          <div className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#0462CB', animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
