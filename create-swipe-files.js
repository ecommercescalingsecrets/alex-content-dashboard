// Create swipe files from existing Gethookd database
const fs = require('fs');
const { execSync } = require('child_process');

function queryDatabase(sql) {
    try {
        const result = execSync(`cd /Users/johnd/Projects/gethookd-modules && sqlite3 gethookd.db "${sql}"`, 
                               { encoding: 'utf8' });
        return result.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
        console.error('Database query failed:', error);
        return [];
    }
}

function parseAdRow(row) {
    const parts = row.split('|');
    return {
        id: parts[0],
        brand_name: parts[1],
        title: parts[2],
        body: parts[3],
        cta_type: parts[4],
        landing_page: parts[5],
        performance_score: parseFloat(parts[6]) || 0,
        days_active: parseInt(parts[7]) || 0,
        used_count: parseInt(parts[8]) || 0,
        media_urls: parts[9],
        created_date: parts[10],
        last_seen_date: parts[11]
    };
}

function hasTransformationWords(text) {
    const keywords = ['lost', 'gained', 'transformed', 'changed my life', 'got my', 'feel like', 'looked in the mirror', 'back to', 'feel amazing'];
    return keywords.some(word => text?.toLowerCase().includes(word));
}

function hasAuthorityWords(text) {
    const keywords = ['dr.', 'doctor', 'expert', 'specialist', 'years of experience', 'trained', 'clinical', 'certified'];
    return keywords.some(word => text?.toLowerCase().includes(word));
}

function isUGCStyle(ad) {
    return (ad.body?.includes('I ') || ad.body?.includes('My ')) &&
           !ad.body?.toLowerCase().includes('dr.') &&
           ad.body?.length < 500; // UGC tends to be shorter
}

function detectHookType(text) {
    if (!text) return 'unknown';
    if (text.includes('"')) return 'testimonial';
    if (text.startsWith('What if') || text.startsWith('Imagine')) return 'hypothetical';
    if (text.includes('secret') || text.includes('discovered')) return 'curiosity';
    if (text.includes('?')) return 'question';
    return 'direct';
}

function analyzeAd(ad) {
    return {
        hook_type: detectHookType(ad.body),
        has_transformation: hasTransformationWords(ad.body),
        has_authority: hasAuthorityWords(ad.body),
        is_ugc_style: isUGCStyle(ad),
        word_count: ad.body?.split(' ').length || 0,
        has_social_proof: ad.body?.includes('customer') || ad.body?.includes('review') || /\d+%/.test(ad.body),
        performance_tier: ad.performance_score >= 80 ? 'elite' : 
                         ad.performance_score >= 60 ? 'strong' : 
                         ad.performance_score >= 40 ? 'decent' : 'weak'
    };
}

async function createSwipeFiles() {
    console.log('🔍 Pulling ads from local database...');
    
    // Get high-performing ads with good data
    const query = `
        SELECT id, brand_name, title, body, cta_type, landing_page, 
               performance_score, days_active, used_count, media_urls, 
               created_date, last_seen_date
        FROM ads 
        WHERE body IS NOT NULL 
        AND body != '' 
        AND performance_score > 0
        ORDER BY performance_score DESC, days_active DESC 
        LIMIT 100;
    `;
    
    const rows = queryDatabase(query);
    const ads = rows.map(parseAdRow);
    
    console.log(`✅ Loaded ${ads.length} ads from database`);
    
    // Create collections
    const collections = {
        'elite-performers': {
            description: 'Top 80+ performance score ads',
            ads: ads.filter(ad => ad.performance_score >= 80),
            criteria: 'Performance score ≥ 80'
        },
        'transformation-hooks': {
            description: 'Ads focused on transformation stories',
            ads: ads.filter(ad => hasTransformationWords(ad.body)),
            criteria: 'Contains transformation keywords'
        },
        'authority-positioning': {
            description: 'Doctor/expert authority plays',
            ads: ads.filter(ad => hasAuthorityWords(ad.body)),
            criteria: 'Contains authority markers (Dr., expert, etc.)'
        },
        'ugc-testimonials': {
            description: 'User-generated content style ads',
            ads: ads.filter(ad => isUGCStyle(ad)),
            criteria: 'Personal voice, first-person style'
        },
        'supplement-winners': {
            description: 'High-performing supplement ads',
            ads: ads.filter(ad => ad.performance_score >= 60),
            criteria: 'Supplement niche + 60+ performance score'
        },
        'long-runners': {
            description: 'Ads running 30+ days (proven profitable)',
            ads: ads.filter(ad => ad.days_active >= 30),
            criteria: '30+ days active (likely profitable)'
        }
    };
    
    // Create swipe-files directory
    if (!fs.existsSync('swipe-files')) {
        fs.mkdirSync('swipe-files');
    }
    
    // Export each collection
    const summary = {
        generated: new Date().toISOString(),
        total_ads_analyzed: ads.length,
        collections: {}
    };
    
    for (const [name, collection] of Object.entries(collections)) {
        const exportData = {
            collection: name,
            description: collection.description,
            criteria: collection.criteria,
            count: collection.ads.length,
            generated: new Date().toISOString(),
            ads: collection.ads.map(ad => ({
                id: ad.id,
                brand: ad.brand_name,
                title: ad.title,
                body: ad.body,
                cta: ad.cta_type,
                performance_score: ad.performance_score,
                days_active: ad.days_active,
                used_count: ad.used_count,
                landing_page: ad.landing_page,
                media: ad.media_urls ? JSON.parse(ad.media_urls) : [],
                analysis: analyzeAd(ad),
                created_date: ad.created_date,
                last_seen_date: ad.last_seen_date
            }))
        };
        
        const filename = `swipe-files/${name}.json`;
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        
        summary.collections[name] = {
            count: collection.ads.length,
            description: collection.description
        };
        
        console.log(`💾 ${name}: ${collection.ads.length} ads → ${filename}`);
    }
    
    // Create summary file
    fs.writeFileSync('swipe-files/summary.json', JSON.stringify(summary, null, 2));
    
    return summary;
}

// Run the script
createSwipeFiles().then(summary => {
    console.log('\n✅ SWIPE FILES CREATED SUCCESSFULLY!');
    console.log('\n📊 Collections Summary:');
    Object.entries(summary.collections).forEach(([name, info]) => {
        console.log(`  📁 ${name}: ${info.count} ads`);
    });
    console.log(`\n📍 Files saved to: /Users/johnd/Projects/alex-content-dashboard/swipe-files/`);
}).catch(error => {
    console.error('❌ Error creating swipe files:', error);
});