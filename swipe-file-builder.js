// Automated Swipe File Builder using Gethookd API
const fetch = require('node-fetch');

class SwipeFileBuilder {
    constructor() {
        this.apiKey = process.env.GETHOOKD_API_KEY || 'gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0';
        this.baseUrl = 'https://app.gethookd.ai/api/v1';
        
        this.collections = {
            'high-performers': {
                filter: ad => ad.performance_score >= 80,
                description: 'Elite performers (80+ score)'
            },
            'transformation-hooks': {
                filter: ad => this.hasTransformationWords(ad.body),
                description: 'Transformation-focused copy'
            },
            'authority-positioning': {
                filter: ad => this.hasAuthorityWords(ad.body),
                description: 'Expert/doctor authority plays'
            },
            'ugc-testimonials': {
                filter: ad => this.isUGCStyle(ad),
                description: 'User-generated content style'
            },
            'supplement-winners': {
                filter: ad => ad.niche === 'supplements' && ad.performance_score >= 70,
                description: 'Top supplement ads'
            }
        };
    }
    
    async createSwipeFiles(pages = 5) {
        console.log('🔍 Pulling ads from Gethookd API...');
        
        const allAds = [];
        
        for (let page = 1; page <= pages; page++) {
            try {
                const response = await fetch(`${this.baseUrl}/explore?page=${page}&per_page=100`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    allAds.push(...data.data);
                    console.log(`📄 Page ${page}: ${data.data.length} ads`);
                } else {
                    break;
                }
            } catch (error) {
                console.error(`❌ Error fetching page ${page}:`, error);
                break;
            }
        }
        
        console.log(`✅ Total ads collected: ${allAds.length}`);
        
        // Organize into collections
        const swipeFiles = {};
        
        for (const [collectionName, config] of Object.entries(this.collections)) {
            swipeFiles[collectionName] = {
                description: config.description,
                ads: allAds.filter(config.filter),
                count: 0
            };
            swipeFiles[collectionName].count = swipeFiles[collectionName].ads.length;
            
            console.log(`📁 ${collectionName}: ${swipeFiles[collectionName].count} ads`);
        }
        
        return swipeFiles;
    }
    
    hasTransformationWords(text) {
        const keywords = ['lost', 'gained', 'transformed', 'changed my life', 'got my', 'feel like', 'looked in the mirror'];
        return keywords.some(word => text?.toLowerCase().includes(word));
    }
    
    hasAuthorityWords(text) {
        const keywords = ['dr.', 'doctor', 'expert', 'specialist', 'years of experience', 'trained', 'clinical'];
        return keywords.some(word => text?.toLowerCase().includes(word));
    }
    
    isUGCStyle(ad) {
        // Simple heuristics for UGC detection
        return ad.media?.some(m => m.type === 'image') && 
               (ad.body?.includes('I') || ad.body?.includes('my')) &&
               !ad.body?.includes('Dr.');
    }
    
    async exportToFiles() {
        const swipeFiles = await this.createSwipeFiles(1); // ~100 ads (1 page)
        const fs = require('fs');
        
        // Export each collection as JSON
        for (const [name, collection] of Object.entries(swipeFiles)) {
            const filename = `swipe-files/${name}.json`;
            const exportData = {
                collection: name,
                description: collection.description,
                count: collection.count,
                generated: new Date().toISOString(),
                ads: collection.ads.map(ad => ({
                    id: ad.id,
                    brand: ad.brand?.name,
                    title: ad.title,
                    body: ad.body,
                    cta: ad.cta_type,
                    score: ad.performance_score,
                    days_active: ad.days_active,
                    landing_page: ad.landing_page,
                    media: ad.media,
                    analysis: this.analyzeAd(ad)
                }))
            };
            
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
            console.log(`💾 Exported ${filename} (${collection.count} ads)`);
        }
        
        return swipeFiles;
    }
    
    analyzeAd(ad) {
        const analysis = {
            hook_type: this.detectHookType(ad.body),
            emotional_trigger: this.detectEmotionalTrigger(ad.body),
            social_proof: this.hasSocialProof(ad.body),
            urgency: this.hasUrgency(ad.body),
            authority: this.hasAuthorityWords(ad.body)
        };
        
        return analysis;
    }
    
    detectHookType(text) {
        if (text?.includes('"')) return 'testimonial';
        if (text?.startsWith('What if') || text?.startsWith('Imagine')) return 'hypothetical';
        if (text?.includes('secret') || text?.includes('discovered')) return 'curiosity';
        return 'direct';
    }
    
    detectEmotionalTrigger(text) {
        if (this.hasTransformationWords(text)) return 'transformation';
        if (text?.includes('pain') || text?.includes('suffering')) return 'pain';
        if (text?.includes('confident') || text?.includes('unstoppable')) return 'empowerment';
        return 'neutral';
    }
    
    hasSocialProof(text) {
        return text?.includes('customers') || text?.includes('reviews') || 
               text?.includes('testimonial') || /\d+%/.test(text);
    }
    
    hasUrgency(text) {
        return text?.includes('limited') || text?.includes('only') || 
               text?.includes('hurry') || text?.includes('expires');
    }
}

module.exports = SwipeFileBuilder;

// Usage example:
// const builder = new SwipeFileBuilder();
// builder.exportToFiles();